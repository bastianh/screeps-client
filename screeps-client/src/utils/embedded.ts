import type { ServerVersion } from 'screeps-connectivity'

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
    /**
     * Full `/api/version` response, inlined into the page by the host mod so the
     * client is configured from the first frame — no pre-login or post-connect
     * fetch needed. Absent when not embedded (or if the mod couldn't prefetch it).
     */
    __SCREEPS_BOOTSTRAP__?: ServerVersion
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
  return import.meta.env.VITE_CLIENT_VERSION ?? ''
}

export function embeddedModInfo(): EmbeddedModInfo | null {
  if (typeof window === 'undefined') return null
  return window.__SCREEPS_CLIENT_EMBEDDED__ ?? null
}

/**
 * The `/api/version` payload the host mod inlined into the page, or `null` when
 * not embedded (or the mod couldn't prefetch it). Lets the client skip the
 * initial version fetch — both pre-login (login UI) and post-connect (via
 * `ScreepsClient`'s `initialVersion`).
 */
export function embeddedServerVersion(): ServerVersion | null {
  if (typeof window === 'undefined') return null
  return window.__SCREEPS_BOOTSTRAP__ ?? null
}

// Returns the path prefix where the app is mounted, without trailing slash.
// e.g. '/client' when mounted as a server mod, '' for standalone.
// BASE_URL may be relative (e.g. './') when built for xxscreeps where the
// mount path is configurable at runtime — treat that as a root mount.
export function basePath(): string {
  const base = import.meta.env.BASE_URL
  if (base.startsWith('.')) return ''
  return base.replace(/\/$/, '')
}
