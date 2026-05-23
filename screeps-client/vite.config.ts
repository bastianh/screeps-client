import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'
import { readFileSync } from 'node:fs'

const base = process.env.VITE_BASE ?? '/'
const outDir = process.env.VITE_OUT_DIR ?? 'dist/standalone'
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

  console.log('[vite.config] VITE_PROXY_TARGET =', proxyTarget)
  if (viteHost) console.log('[vite.config] VITE_HOST =', viteHost, 'port', viteHostPort)

  return {
    base,
    plugins: [
      devtools({ autoname: true }),
      solid(),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/pixi.js/')) return 'vendor-pixi'
            if (
              id.includes('/node_modules/codemirror/') ||
              id.includes('/node_modules/@codemirror/') ||
              id.includes('/node_modules/solid-codemirror/')
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
      proxy: proxyTarget ? {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/socket': { target: proxyTarget, changeOrigin: true, ws: true },
      } : undefined,
    },
    resolve: {
      conditions: ['development'],
      alias: {
        '~/': '/src/',
      },
    },
  }
})
