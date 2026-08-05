/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import { readFileSync } from 'node:fs'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { screepsTsLibs } from './vite-plugin-ts-libs.js'

const base = process.env.VITE_BASE ?? '/'
const outDir = process.env.VITE_OUT_DIR ?? 'dist/standalone'
const assetsDir = process.env.VITE_ASSETS_DIR ?? '_client'
const clientPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const clientVersion = process.env.VITE_CLIENT_VERSION ?? clientPkg.version

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET
  // When serving behind an HTTPS reverse proxy (e.g. tailscale serve 5173),
  // set VITE_HOST to the external hostname so HMR WebSocket uses wss:// on
  // the proxy's port instead of Vite's local port.
  // VITE_HOST_PORT defaults to 443 (tailscale serve default).
  const viteHost = env.VITE_HOST
  const viteHostPort = env.VITE_HOST_PORT ? parseInt(env.VITE_HOST_PORT) : 443

  const debugProxy = env.VITE_DEBUG_PROXY
  const debugAgent = debugProxy ? new HttpsProxyAgent(debugProxy, { rejectUnauthorized: false }) : undefined

  console.log('[vite.config] VITE_PROXY_TARGET =', proxyTarget)
  if (viteHost) console.log('[vite.config] VITE_HOST =', viteHost, 'port', viteHostPort)
  if (debugProxy) console.log('[vite.config] VITE_DEBUG_PROXY =', debugProxy)

  return {
    base,
    plugins: [
      solid(),
      screepsTsLibs(),
    ],
    // The TS language service runs in a Web Worker; the virtual lib module must
    // resolve inside the worker bundle too (Vite builds workers with their own
    // plugin set).
    worker: {
      format: 'es',
      plugins: () => [screepsTsLibs()],
    },
    build: {
      outDir,
      assetsDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/pixi.js/')) return 'vendor-pixi'
            // solid-codemirror must NOT be listed here: forcing it into the
            // vendor chunk drags its solid-js dependency in with it, and since
            // the whole app needs solid-js the entry chunk then statically
            // imports (and preloads) all of CodeMirror — even though the three
            // editor panels are lazy(). Left unassigned, solid-codemirror rides
            // along in the editor chunks and solid-js stays in the eager graph.
            if (
              id.includes('/node_modules/codemirror/') ||
              id.includes('/node_modules/@codemirror/')
            ) {
              return 'vendor-codemirror'
            }
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify(clientVersion),
    },
    server: {
      host: viteHost ? true : undefined,
      allowedHosts: viteHost ? [viteHost] : undefined,
      hmr: viteHost ? { protocol: 'wss', clientPort: viteHostPort } : undefined,
      proxy: {
        // Proxy Screeps decoration textures from S3 to avoid CORS in dev
        '/__screeps_s3__': {
          target: 'https://s3.amazonaws.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__screeps_s3__/, ''),
        },
        ...(proxyTarget ? {
          '/api': { target: proxyTarget, changeOrigin: true, agent: debugAgent, secure: !debugAgent },
          '/room-history': { target: proxyTarget, changeOrigin: true, agent: debugAgent, secure: !debugAgent },
          // Server-hosted assets (badges, textures, …). In production the client
          // is served by the backend itself, so /assets resolves natively there;
          // in dev it has to be proxied. Safe to claim: the build writes its own
          // assets to VITE_ASSETS_DIR (_client/), not /assets.
          '/assets': { target: proxyTarget, changeOrigin: true, agent: debugAgent, secure: !debugAgent },
          '/socket': { target: proxyTarget, changeOrigin: true, ws: true, agent: debugAgent, secure: !debugAgent },
        } : {}),
      },
    },
    resolve: {
      alias: {
        '~/': '/src/',
      },
    },
    test: {
      setupFiles: ['./tests/setup.ts'],
    },
  }
})
