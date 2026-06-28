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
 * Replace the global fetch with the Tauri HTTP plugin's fetch. Requests are then
 * performed in Rust (reqwest), bypassing WebView CORS so the client can talk to
 * official and arbitrary private Screeps servers. The plugin returns a web-standard
 * Response, so HttpClient's header reads (x-token, x-ratelimit-*) and res.json()
 * keep working unchanged. Idempotent.
 */
export async function installTauriFetch(): Promise<void> {
  if (fetchInstalled) return
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
  window.fetch = tauriFetch as typeof window.fetch
  fetchInstalled = true
}
