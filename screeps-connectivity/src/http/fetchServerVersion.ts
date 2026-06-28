import type { ServerVersion } from '../types/game.js'
import type { ScreepsmodAuthFeature, ServerFeature } from '../types/game.js'
import type { ApiAuthModInfoResponse, ApiRegisterCheckResponse } from '../types/api.js'
import { getFetch } from './fetchFn.js'

export type { ApiAuthModInfoResponse }

const SESSION_CACHE_TTL_MS = 5 * 60_000

interface CachedEntry<T> {
  data: T
  expires: number
}

function sessionKey(suffix: string, url: string): string {
  try {
    return `screeps:${suffix}:${new URL(url).hostname}`
  } catch {
    return `screeps:${suffix}:${url}`
  }
}

function readFromSession<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry<T>
    if (Date.now() > entry.expires) {
      sessionStorage.removeItem(key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function writeToSession<T>(key: string, data: T): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, expires: Date.now() + SESSION_CACHE_TTL_MS }))
  } catch { /* quota exceeded or SSR — ignore */ }
}

function baseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

/**
 * Fetch `/api/version` from a Screeps server without authentication.
 * The result is cached in `sessionStorage` for 5 minutes (per server hostname).
 * Useful for pre-login UI: showing the welcome text and detecting installed mods.
 */
export async function fetchServerVersion(url: string): Promise<ServerVersion> {
  const key = sessionKey('version', url)
  const cached = readFromSession<ServerVersion>(key)
  if (cached) return cached

  const res = await getFetch()(`${baseUrl(url)}api/version`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as ServerVersion
  writeToSession(key, data)
  return data
}

/**
 * Fetch screepsmod-auth capabilities from `/api/authmod` without authentication.
 * Returns `null` if the server does not run screepsmod-auth.
 * The result is cached in `sessionStorage` for 5 minutes (per server hostname).
 */
export async function fetchAuthModInfo(url: string): Promise<ApiAuthModInfoResponse | null> {
  const key = sessionKey('authmod', url)
  const cached = readFromSession<ApiAuthModInfoResponse>(key)
  if (cached) return cached

  const res = await getFetch()(`${baseUrl(url)}api/authmod`)
  if (!res.ok) return null
  const data = await res.json() as ApiAuthModInfoResponse
  if (!data.ok) return null
  writeToSession(key, data)
  return data
}

/**
 * Check whether a username is available on a screepsmod-auth server.
 * Returns `{ ok: 1 }` if available, `{ ok: 0, error: 'User Exists' }` if taken.
 */
export async function checkUsername(url: string, username: string): Promise<ApiRegisterCheckResponse> {
  const params = new URLSearchParams({ username })
  const res = await getFetch()(`${baseUrl(url)}api/register/check-username?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ApiRegisterCheckResponse>
}

/**
 * Check whether an email address is available on a screepsmod-auth server.
 * Returns `{ ok: 1 }` if available, `{ ok: 0, error: 'User Exists' }` if taken.
 */
export async function checkEmail(url: string, email: string): Promise<ApiRegisterCheckResponse> {
  const params = new URLSearchParams({ email })
  const res = await getFetch()(`${baseUrl(url)}api/register/check-email?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ApiRegisterCheckResponse>
}

/**
 * Register a new user account on a screepsmod-auth private server.
 * No authentication required. Throws if the server returns an error response.
 */
export async function registerUser(
  url: string,
  username: string,
  email: string,
  password: string,
): Promise<{ ok: number; error?: string }> {
  const res = await getFetch()(`${baseUrl(url)}api/register/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ ok: number; error?: string }>
}

/**
 * Extract a specific feature entry from a `ServerVersion` response by name.
 * Returns `undefined` if the feature is not present.
 *
 * @example
 * const authMod = getServerFeature<ScreepsmodAuthFeature>(version, 'screepsmod-auth')
 * if (authMod) console.log('Auth types:', authMod.authTypes)
 */
export function getServerFeature<T extends ServerFeature = ServerFeature>(
  version: ServerVersion,
  name: string,
): T | undefined {
  return version.serverData.features.find(f => f.name === name) as T | undefined
}

/**
 * Returns the `screepsmod-auth` feature entry if present, otherwise `undefined`.
 * Use this to check whether the server supports password login, registration,
 * Steam auth, etc., before showing those UI options.
 *
 * @example
 * const auth = getScreepsmodAuth(version)
 * if (auth?.authTypes.includes('password')) showPasswordForm()
 */
export function getScreepsmodAuth(version: ServerVersion): ScreepsmodAuthFeature | undefined {
  return getServerFeature<ScreepsmodAuthFeature>(version, 'screepsmod-auth')
}
