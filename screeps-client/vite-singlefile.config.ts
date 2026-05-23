import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'

const clientPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const clientVersion = process.env.VITE_CLIENT_VERSION ?? clientPkg.version

export default defineConfig({
  plugins: [solid(), viteSingleFile()],
  build: {
    outDir: 'dist/bundle',
    emptyOutDir: true,
  },
  define: {
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify(clientVersion),
  },
  resolve: {
    alias: {
      '~/': '/src/',
    },
  },
})
