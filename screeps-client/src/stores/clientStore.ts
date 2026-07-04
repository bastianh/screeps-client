import { createSignal } from 'solid-js'
import { ScreepsClient, PasswordAuth, TokenAuth, GuestAuth, IndexedDBStorage } from 'screeps-connectivity'
import type { AuthStrategy, StorageAdapter, UserInfo, ServerVersion, WorldInfo, WorldStatus, ApiRoomDecorationsResponse } from 'screeps-connectivity'
import { addToast } from './toastStore.js'
import { isEmbedded, embeddedServerUrl } from '~/utils/embedded.js'
import { isTauri } from '~/utils/tauri.js'
import { createLogger } from '~/utils/log.js'
import { SS, getSession, setSession, removeSession } from '~/utils/storage.js'
import {
  saveTokenForUrl,
  loadTokenForUrl,
  deleteTokenForUrl,
  saveServerPasswordForUrl,
  loadServerPasswordForUrl,
  deleteServerPasswordForUrl,
} from '~/utils/keychain.js'


export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface UserFlag {
  room: string
  x: number
  y: number
  color?: number
  secondaryColor?: number
}

const { log } = createLogger('client')

const [client, setClient] = createSignal<ScreepsClient | null>(null)
const [status, setStatus] = createSignal<ConnectionStatus>('idle')
const [error, setError] = createSignal<string | null>(null)
// Fatal error on an already-connected session (socket gave up reconnecting, or
// the server closed the connection for good). Unlike `error` (shown inline on
// the login form for failed connect attempts), this keeps the Dashboard mounted
// and shows a popup — see SessionErrorModal — so the user can choose to reload
// or log out instead of being silently bounced back to the login screen.
const [sessionError, setSessionError] = createSignal<string | null>(null)
export interface RateLimitError {
  message: string
  /** The server's "disable rate limiting" link, extracted from the error body, if present. */
  disableLink: string | null
}
// Set when a request comes back 429 — the official server rate-limits API
// tokens and includes a per-account link to disable it. Shown as a dismissable
// popup (RateLimitModal) rather than a toast, since it needs the link.
const [rateLimitError, setRateLimitError] = createSignal<RateLimitError | null>(null)
const [userInfo, setUserInfo] = createSignal<UserInfo | null>(null)
const [serverVersion, setServerVersion] = createSignal<ServerVersion | null>(null)
const [gameTime, setGameTime] = createSignal<number | null>(null)
const [tickDuration, setTickDuration] = createSignal<number | null>(null)
const [isGuest, setIsGuest] = createSignal(false)
const [authMethod, setAuthMethod] = createSignal<'password' | 'steam' | 'token' | 'guest' | null>(null)
const [worldBounds, setWorldBounds] = createSignal<WorldInfo | null>(null)
const [userFlags, setUserFlags] = createSignal<Record<string, UserFlag>>({})
const [worldStatus, setWorldStatus] = createSignal<WorldStatus | null>(null)

// While the user has lost all spawns ('lost') or hasn't placed a first spawn
// ('empty'), world status only refreshes on the slow idle path, so a respawn or
// first-spawn placement can go unnoticed for up to a minute. Poll frequently in
// those states so the UI reacts almost immediately, and stop once 'normal'.
const WORLD_STATUS_POLL_MS = 1000
// After an action we know changes world state (e.g. respawn), the server may
// still briefly report the old status. Force-poll for this window regardless of
// the current status so we catch the transition instead of relying on one check.
const WORLD_STATUS_FORCE_POLL_MS = 15_000
let worldStatusPollTimer: ReturnType<typeof setInterval> | null = null
let worldStatusPollUntil = 0

function startWorldStatusPolling(): void {
  if (worldStatusPollTimer !== null) return
  log('world status polling: start')
  worldStatusPollTimer = setInterval(() => {
    const c = client()
    if (!c) return
    void c.stores.user.refreshWorldStatus().catch(() => {})
  }, WORLD_STATUS_POLL_MS)
}

function stopWorldStatusPolling(): void {
  if (worldStatusPollTimer === null) return
  log('world status polling: stop')
  clearInterval(worldStatusPollTimer)
  worldStatusPollTimer = null
}

function updateWorldStatusPolling(s: WorldStatus | null): void {
  const shouldPoll = s === 'empty' || s === 'lost' || Date.now() < worldStatusPollUntil
  if (shouldPoll) startWorldStatusPolling()
  else stopWorldStatusPolling()
}

/**
 * Force world-status polling on for a short window, e.g. right after a respawn,
 * so the resulting state change is picked up quickly even while the server still
 * reports the old status. The poll loop reverts to status-based behaviour (and
 * stops once 'normal') after the window elapses.
 */
export function expectWorldStatusChange(): void {
  worldStatusPollUntil = Date.now() + WORLD_STATUS_FORCE_POLL_MS
  startWorldStatusPolling()
}

let lastGameTime = -1
let lastTickTimestamp = -1
const tickDurations: number[] = []
const MAX_TICK_SAMPLES = 5

export function recordGameTime(gt: number | undefined): void {
  if (gt === undefined) return
  const now = Date.now()
  if (lastGameTime >= 0 && gt > lastGameTime) {
    const elapsed = now - lastTickTimestamp
    if (elapsed > 0) {
      tickDurations.push(elapsed)
      if (tickDurations.length > MAX_TICK_SAMPLES) {
        tickDurations.shift()
      }
      const avg = tickDurations.reduce((a, b) => a + b, 0) / tickDurations.length
      setTickDuration(Math.round(avg))
      // log(`tick ${lastGameTime} → ${gt}  elapsed ${elapsed}ms  avg ${Math.round(avg)}ms`)
    }
  }
  lastGameTime = gt
  lastTickTimestamp = now
}

export function resetTickTracking(): void {
  lastGameTime = -1
  lastTickTimestamp = -1
  tickDurations.length = 0
  setTickDuration(null)
}

export const isPrivateServer = () => {
  const v = serverVersion()
  if (!v) return null
  return (v.serverData?.shards?.length ?? 0) === 0
}

export { client, status, error, sessionError, rateLimitError, setRateLimitError, userInfo, serverVersion, gameTime, setGameTime, tickDuration, setTickDuration, isGuest, authMethod, worldBounds, setWorldBounds, userFlags, worldStatus }

export async function connect(opts: {
  url: string
  auth: 'password' | 'token' | 'guest'
  /** Original login method, preserved across reloads. Defaults to `auth`. Auto-connect passes the persisted value so a password/steam login still reports its real method even though it reconnects via its session token. Steam logins use `auth: 'token'` but should report 'steam'. */
  authMethod?: 'password' | 'steam' | 'token' | 'guest'
  email?: string
  password?: string
  token?: string
  serverPassword?: string
  decorationsMock?: ApiRoomDecorationsResponse
  storage?: StorageAdapter | null
}): Promise<void> {
  if (isEmbedded()) {
    opts = { ...opts, url: embeddedServerUrl() }
  }
  log(`connecting to ${opts.url} (auth: ${opts.auth})`)
  setStatus('connecting')
  setError(null)
  setSessionError(null)
  setRateLimitError(null)

  try {
    let authStrategy: AuthStrategy
    if (opts.auth === 'guest') {
      authStrategy = new GuestAuth()
      setIsGuest(true)
    } else if (opts.auth === 'password') {
      if (!opts.email || !opts.password) {
        throw new Error('Email and password are required')
      }
      authStrategy = new PasswordAuth({ email: opts.email, password: opts.password })
    } else {
      if (!opts.token) {
        throw new Error('Token is required')
      }
      authStrategy = new TokenAuth({ token: opts.token })
    }

    const screepsClient = new ScreepsClient({
      url: opts.url,
      auth: authStrategy,
      storage: opts.storage ?? new IndexedDBStorage('screeps-client'),
      debug: false,
      serverPassword: opts.serverPassword,
    })

    screepsClient.http.on('http:tokenRefresh', ({ token }) => {
      log('token refreshed')
      if (isTauri()) {
        void saveTokenForUrl(opts.url, token)
      } else {
        setSession(SS.token, token)
      }
    })

    screepsClient.http.on('http:error', ({ method, path, error, silent, status }) => {
      log('http error:', method, path, error.message)
      if (status === 429) {
        const linkMatch = error.message.match(/https?:\/\/\S+/)
        setRateLimitError({
          message: error.message.replace(/^HTTP 429:\s*/, ''),
          disableLink: linkMatch ? linkMatch[0] : null,
        })
        return
      }
      // Optional endpoints (e.g. /api/user/overview) opt out of the toast; the
      // caller handles their failure, so don't nag the user about it.
      if (!silent) addToast(`Request failed: ${method} ${path} — ${error.message}`, 'error', 6000)
    })

    screepsClient.stores.server.on('server:disconnected', (data) => {
      log(`server disconnected (willReconnect: ${data.willReconnect})`)
      if (!data.willReconnect) {
        worldStatusPollUntil = 0
        updateWorldStatusPolling(null)
        setSessionError('Lost connection to the server.')
      }
    })

    screepsClient.stores.server.on('server:error', (data) => {
      log('server error:', data.error.message)
      setSessionError(data.error.message)
    })

    screepsClient.stores.user.on('user:me', (info) => {
      log(`user: ${info.username} (id: ${info._id})`)
      setUserInfo(info)
    })

    screepsClient.stores.server.on('server:version', (v) => {
      log(`server version: ${v.package ?? 'unknown'}`)
      setServerVersion(v)
    })

    screepsClient.stores.user.on('user:stream', (payload) => {
      if (payload && typeof payload === 'object' && 'flags' in payload) {
        const flags = payload.flags as Record<string, UserFlag> | undefined
        if (flags && typeof flags === 'object') {
          setUserFlags(flags)
        }
      }
    })

    screepsClient.stores.user.on('user:worldStatus', ({ status }) => {
      log(`world status: ${status}`)
      setWorldStatus(status)
      updateWorldStatusPolling(status)
    })

    await screepsClient.connect()
    screepsClient.stores.user.subscribeUserStream()
    setClient(screepsClient)
    setStatus('connected')
    log(`connected to ${opts.url}`)
    setSession(SS.url, opts.url)
    const resolvedAuthMethod = opts.authMethod ?? opts.auth
    setAuthMethod(resolvedAuthMethod)
    setSession(SS.authMethod, resolvedAuthMethod)
    if (screepsClient.http.token) {
      if (isTauri()) {
        await saveTokenForUrl(opts.url, screepsClient.http.token)
      } else {
        // Browser: sessionStorage (origin-scoped, cleared on tab close).
        setSession(SS.token, screepsClient.http.token)
      }
    }
    if (opts.serverPassword) {
      if (isTauri()) {
        await saveServerPasswordForUrl(opts.url, opts.serverPassword)
      } else {
        setSession(SS.serverPassword, opts.serverPassword)
      }
    } else {
      if (isTauri()) {
        void deleteServerPasswordForUrl(opts.url)
      } else {
        removeSession(SS.serverPassword)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('connection failed:', message)
    setError(message)
    setStatus('error')
    setClient(null)
    throw err
  }
}

export async function tryAutoConnect(): Promise<void> {
  const url = isEmbedded() ? embeddedServerUrl() : getSession(SS.url)
  if (!url) return

  let token: string | null
  let serverPassword: string | undefined

  if (isTauri()) {
    token = await loadTokenForUrl(url)
    serverPassword = (await loadServerPasswordForUrl(url)) ?? undefined
  } else {
    token = getSession(SS.token)
    serverPassword = getSession(SS.serverPassword) ?? undefined
  }

  if (!token) return

  const storedAuthMethod = getSession(SS.authMethod) as 'password' | 'steam' | 'token' | 'guest' | null
  log(`auto-connect: ${url}`)
  try {
    if (token === 'guest') {
      await connect({ url, auth: 'guest', storage: null, serverPassword })
    } else {
      await connect({ url, auth: 'token', token, serverPassword, authMethod: storedAuthMethod ?? 'token' })
    }
  } catch {
    log('auto-connect failed — clearing stored token')
    if (isTauri()) {
      void deleteTokenForUrl(url)
    } else {
      removeSession(SS.token)
    }
  }
}

export function disconnect(): void {
  log('disconnecting')
  if (isTauri()) {
    const url = getSession(SS.url)
    const currentAuthMethod = authMethod()
    if (url) {
      // For token auth the session token IS the user's login credential — keep it
      // so the next launch can auto-connect. Password/steam logins produce a
      // temporary session token that is safe to discard.
      if (currentAuthMethod !== 'token') {
        void deleteTokenForUrl(url)
      }
      // Server password is a static access credential, not a session token —
      // leave it in the keychain so it survives logout.
    }
  }
  const c = client()
  if (c) {
    c.disconnect()
  }
  setClient(null)
  setStatus('idle')
  setError(null)
  setSessionError(null)
  setRateLimitError(null)
  setUserInfo(null)
  setServerVersion(null)
  setGameTime(null)
  setIsGuest(false)
  setAuthMethod(null)
  setWorldBounds(null)
  setUserFlags({})
  setWorldStatus(null)
  worldStatusPollUntil = 0
  updateWorldStatusPolling(null)
  resetTickTracking()
  if (isTauri()) {
    // In Tauri all session keys live in localStorage (app-private). Credentials
    // and the server URL are persisted intentionally — clear only the auth method
    // so the next auto-connect picks it up fresh from the stored token.
    removeSession(SS.authMethod)
  } else {
    removeSession(SS.token)
    removeSession(SS.url)
    removeSession(SS.serverPassword)
    removeSession(SS.authMethod)
  }
}
