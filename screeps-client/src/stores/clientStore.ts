import { createSignal } from 'solid-js'
import { ScreepsClient, PasswordAuth, TokenAuth, GuestAuth, IndexedDBStorage } from 'screeps-connectivity'
import type { AuthStrategy, StorageAdapter, UserInfo, ServerVersion, WorldInfo, WorldStatus, ApiRoomDecorationsResponse } from 'screeps-connectivity'
import { addToast } from './toastStore.js'
import { isEmbedded, embeddedServerUrl } from '~/utils/embedded.js'
import { createLogger } from '~/utils/log.js'
import { SS, getSession, setSession, removeSession } from '~/utils/storage.js'


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

export { client, status, error, userInfo, serverVersion, gameTime, setGameTime, tickDuration, setTickDuration, isGuest, authMethod, worldBounds, setWorldBounds, userFlags, worldStatus }

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
      setSession(SS.token, token)
    })

    screepsClient.http.on('http:error', ({ method, path, error, silent }) => {
      log('http error:', method, path, error.message)
      // Optional endpoints (e.g. /api/user/overview) opt out of the toast; the
      // caller handles their failure, so don't nag the user about it.
      if (!silent) addToast(`Request failed: ${method} ${path} — ${error.message}`, 'error', 6000)
    })

    screepsClient.stores.server.on('server:disconnected', (data) => {
      log(`server disconnected (willReconnect: ${data.willReconnect})`)
      if (!data.willReconnect) {
        setStatus('idle')
        setClient(null)
        setUserInfo(null)
        setServerVersion(null)
        worldStatusPollUntil = 0
        updateWorldStatusPolling(null)
      }
    })

    screepsClient.stores.server.on('server:error', (data) => {
      log('server error:', data.error.message)
      setError(data.error.message)
      setStatus('error')
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
    // Auth token and the private-server gate password are persisted to sessionStorage so
    // tryAutoConnect() can reconnect after a page reload without re-prompting. sessionStorage is
    // origin-scoped and cleared when the tab closes. This is an accepted tradeoff: any value here
    // is readable by page JS under XSS, but the same applies to the session token stored alongside
    // it, and keeping these only in memory would force a re-login on every reload.
    if (screepsClient.http.token) {
      setSession(SS.token, screepsClient.http.token)
    }
    if (opts.serverPassword) {
      setSession(SS.serverPassword, opts.serverPassword)
    } else {
      removeSession(SS.serverPassword)
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
  const token = getSession(SS.token)
  if (!url || !token) return

  const serverPassword = getSession(SS.serverPassword) ?? undefined
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
    removeSession(SS.token)
  }
}

export function disconnect(): void {
  log('disconnecting')
  const c = client()
  if (c) {
    c.disconnect()
  }
  setClient(null)
  setStatus('idle')
  setError(null)
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
  removeSession(SS.token)
  removeSession(SS.url)
  removeSession(SS.serverPassword)
  removeSession(SS.authMethod)
}
