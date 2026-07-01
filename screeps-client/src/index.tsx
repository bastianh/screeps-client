import { render } from 'solid-js/web'
import { isTauri, installTauriFetch } from './utils/tauri.js'

if (import.meta.env.DEV && !isTauri()) {
  await import('@solid-devtools/debugger/setup')
}

if (isTauri()) {
  // In the desktop app, route screeps-connectivity's fetch through the Tauri HTTP
  // plugin (reqwest in Rust), bypassing WKWebView CORS. Does not touch window.fetch.
  await installTauriFetch()

  // Tauri's CSP has no 'unsafe-eval' in script-src, and pixi.js otherwise needs
  // eval() / new Function() to compile shaders and sync uniforms. Scoped to Tauri
  // only: this polyfill trades away pixi's faster JIT-generated sync path, which
  // the browser/embedded builds don't need to give up.
  await import('pixi.js/unsafe-eval')
}

import { App } from './app/App.js'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

render(() => <App />, root)
