import { render } from 'solid-js/web'
import { isTauri, installTauriFetch } from './utils/tauri.js'

if (import.meta.env.DEV && !isTauri()) {
  await import('@solid-devtools/debugger/setup')
}

// In the desktop app, route screeps-connectivity's fetch through the Tauri HTTP
// plugin (reqwest in Rust), bypassing WKWebView CORS. Does not touch window.fetch.
if (isTauri()) {
  await installTauriFetch()
}

import { App } from './app/App.js'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

render(() => <App />, root)
