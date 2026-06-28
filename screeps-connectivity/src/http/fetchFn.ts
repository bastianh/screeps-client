let _fetch: typeof globalThis.fetch | undefined

/**
 * Override the fetch implementation used by all screeps-connectivity HTTP calls.
 * Call this once at app startup when the platform requires a custom transport
 * (e.g. Tauri desktop, where the native WKWebView fetch cannot reach cross-origin
 * Screeps servers and the Tauri HTTP plugin must be used instead).
 *
 * When not called, screeps-connectivity uses `globalThis.fetch`.
 */
export function setFetch(fetchFn: typeof globalThis.fetch): void {
  _fetch = fetchFn
}

export function getFetch(): typeof globalThis.fetch {
  return _fetch ?? globalThis.fetch
}
