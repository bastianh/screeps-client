import { render } from 'solid-js/web'
import { isTauri, installTauriFetch } from './utils/tauri.js'

if (import.meta.env.DEV) {
  await import('@solid-devtools/debugger/setup')
}

// In the desktop app, route fetch through the Tauri HTTP plugin before any
// ScreepsClient request runs (bypasses WebView CORS). No-op in the browser.
if (isTauri()) {
  await installTauriFetch()
}

import { App } from './app/App.js'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

render(() => <App />, root)
