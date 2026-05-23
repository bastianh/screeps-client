const BUILD_FLAG = import.meta.env.VITE_EMBEDDED === 'true'
const XXSCREEPS_FLAG = import.meta.env.VITE_XXSCREEPS === 'true'

export interface EmbeddedModInfo {
  kind: 'screeps-mod' | 'xxscreeps-mod'
  packageName: string
  version: string
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_CLIENT_VERSION: string
  }

  interface Window {
    __SCREEPS_CLIENT_EMBEDDED__?: EmbeddedModInfo
  }
}

export function isEmbedded(): boolean {
  if (BUILD_FLAG) return true
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/client')
}

export function isXxscreepsMode(): boolean {
  return XXSCREEPS_FLAG
}

export function embeddedServerUrl(): string {
  return window.location.origin
}

export function clientVersion(): string {
  return import.meta.env.VITE_CLIENT_VERSION
}

export function embeddedModInfo(): EmbeddedModInfo | null {
  if (typeof window === 'undefined') return null
  return window.__SCREEPS_CLIENT_EMBEDDED__ ?? null
}

// Returns the path prefix where the app is mounted, without trailing slash.
// e.g. '/client' when mounted as a server mod, '' for standalone.
export function basePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '')
}
