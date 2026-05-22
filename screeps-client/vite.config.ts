import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'

const base = process.env.VITE_BASE ?? '/'
const outDir = process.env.VITE_OUT_DIR ?? 'dist/standalone'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET
  console.log('[vite.config] VITE_PROXY_TARGET =', proxyTarget)

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
    server: proxyTarget ? {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/socket': { target: proxyTarget, changeOrigin: true, ws: true },
      },
    } : undefined,
    resolve: {
      conditions: ['development'],
      alias: {
        '~/': '/src/',
      },
    },
  }
})
