// Tauri desktop integration. All entry points are guarded by isTauri() so the web
// and embedded browser builds are unaffected (the @tauri-apps/* modules are only
// ever dynamically imported when running inside the native shell).

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

/** True when running inside the Tauri WebView (native desktop app). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ != null
}

let fetchInstalled = false

/**
 * Wire the Tauri HTTP plugin's fetch into screeps-connectivity so that all
 * Screeps API requests are performed in Rust (reqwest), bypassing WKWebView CORS.
 * Does NOT patch window.fetch — only screeps-connectivity's internal transport is
 * affected, leaving Vite HMR, devtools, and other browser APIs untouched. Idempotent.
 */
export async function installTauriFetch(): Promise<void> {
  if (fetchInstalled) return
  const [{ fetch: tauriFetch }, { setFetch }] = await Promise.all([
    import('@tauri-apps/plugin-http'),
    import('screeps-connectivity'),
  ])
  setFetch(tauriFetch as typeof globalThis.fetch)
  fetchInstalled = true
}

/**
 * Open a URL in the user's default OS browser. In the Tauri desktop app,
 * `window.open` would just navigate the app's own WebView, so this uses the
 * opener plugin (Rust-side, via the OS "open" call) instead. In the regular
 * browser build it's a plain new-tab open.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
