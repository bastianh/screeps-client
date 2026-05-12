import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      '/api': {
        target: 'https://screeps.w4rl0ck.dev',
        changeOrigin: true,
      },
      '/socket': {
        target: 'https://screeps.w4rl0ck.dev',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '~/': '/src/',
      'screeps-connectivity': resolve(__dirname, '../screeps-connectivity/src/index.ts'),
      'screeps-connectivity/file-storage': resolve(__dirname, '../screeps-connectivity/src/file-storage.ts'),
    },
  },
})
