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
