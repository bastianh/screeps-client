import { decompressGzip } from './decompress.js'
import { getFetch } from './fetchFn.js'
import { Logger } from '../logger.js'
import type { AuthStrategy } from './auth/AuthStrategy.js'
import { createAuthEndpoints, type AuthEndpoints } from './endpoints/auth.js'
import { createGameEndpoints, type GameEndpoints } from './endpoints/game.js'
import { createUserEndpoints, type UserEndpoints } from './endpoints/user.js'
import { createLeaderboardEndpoints, type LeaderboardEndpoints } from './endpoints/leaderboard.js'
import { createExperimentalEndpoints, type ExperimentalEndpoints } from './endpoints/experimental.js'
import { createRegisterEndpoints, type RegisterEndpoints } from './endpoints/register.js'
import type { HttpClientEvents } from '../types/events.js'
import type { Subscription } from '../subscription/index.js'

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export interface RequestOptions {
  /** Internal: marks the post-auth retry so a second 401 doesn't loop. */
  isRetry?: boolean
  /** Suppress user-facing surfacing of failures (the http:error event carries the
   *  flag through). Use for optional endpoints the caller handles gracefully. */
  silent?: boolean
}

export class HttpClient extends EventTarget {
  readonly baseUrl: string
  private readonly authStrategy: AuthStrategy
  private readonly logger: Logger
  private readonly serverPassword: string | null
  token: string | null = null
  readonly rateLimits = new Map<string, RateLimitInfo>()
  private authenticating = false

  readonly auth: AuthEndpoints
  readonly register: RegisterEndpoints
  readonly game: GameEndpoints
  readonly user: UserEndpoints
  readonly leaderboard: LeaderboardEndpoints
  readonly experimental: ExperimentalEndpoints

  constructor(opts: { url: string; auth: AuthStrategy; logger?: Logger; serverPassword?: string; decorationsMock?: import('../types/api.js').ApiRoomDecorationsResponse }) {
    super()
    this.baseUrl = opts.url.endsWith('/') ? opts.url : `${opts.url}/`
    this.authStrategy = opts.auth
    this.logger = opts.logger ?? Logger.create()
    this.serverPassword = opts.serverPassword ?? null
    this.auth = createAuthEndpoints(this)
    this.register = createRegisterEndpoints(this)
    this.game = createGameEndpoints(this, opts.decorationsMock)
    this.user = createUserEndpoints(this)
    this.leaderboard = createLeaderboardEndpoints(this)
    this.experimental = createExperimentalEndpoints(this)
  }

  emit<K extends string & keyof HttpClientEvents>(type: K, detail: HttpClientEvents[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  on<K extends string & keyof HttpClientEvents>(
    type: K,
    handler: (detail: HttpClientEvents[K]) => void,
  ): Subscription {
    const listener = (e: Event) => handler((e as CustomEvent<HttpClientEvents[K]>).detail)
    this.addEventListener(type, listener)
    return {
      dispose: () => {
        this.removeEventListener(type, listener)
      },
    }
  }

  async authenticate(): Promise<void> {
    this.logger.log('authenticate')
    this.authenticating = true
    try {
      this.token = await this.authStrategy.authenticate(this)
      this.logger.log('authenticated')
    } finally {
      this.authenticating = false
    }
  }

  /** Update the stored token. Used to keep HTTP and WS token in sync after a WS auth rotation. */
  setToken(token: string): void {
    this.token = token
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, opts: RequestOptions = {}): Promise<T> {
    this.logger.log(method, path)
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.baseUrl)
    const headers: Record<string, string> = {}

    if (this.token) {
      headers['X-Token'] = this.token
      // passport-token strategy requires both x-token and x-username to be present.
      // The server ignores the username value but fails auth if the header is missing.
      headers['X-Username'] = this.token
    }
    if (this.serverPassword) {
      headers['X-Server-Password'] = this.serverPassword
    }

    const init: RequestInit = { method, headers }

    if (method === 'GET' && body) {
      for (const [k, v] of Object.entries(body)) {
        if (v != null) url.searchParams.set(k, String(v))
      }
    } else if (body) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const res = await getFetch()(url.toString(), init)

    const newToken = res.headers.get('x-token')
    if (newToken) {
      this.token = newToken
      this.emit('http:tokenRefresh', { token: newToken })
    }

    this.updateRateLimit(path, res)

    if (res.status === 401 && !opts.isRetry && !this.authenticating) {
      await this.authenticate()
      return this.request<T>(method, path, body, { ...opts, isRetry: true })
    }

    // 304: some servers (e.g. private Screeps) send a body with 304 — treat it as success
    if (!res.ok && res.status !== 304) {
      let body = ''
      try { body = await res.text() } catch { /* ignore */ }
      const error = new Error(`HTTP ${res.status}: ${body}`)
      this.emit('http:error', { method, path, status: res.status, error, silent: opts.silent })
      throw error
    }

    this.emit('http:success', { method, path, status: res.status })

    const data = await res.json() as Record<string, unknown>

    if (typeof data['error'] === 'string') {
      const error = new Error(`Screeps API error: ${data['error']}`)
      this.emit('http:error', { method, path, status: res.status, error, silent: opts.silent })
      throw error
    }

    if (typeof data['data'] === 'string' && (data['data'] as string).startsWith('gz:')) {
      data['data'] = await decompressGzip(data['data'] as string)
    }

    return data as T
  }

  private updateRateLimit(path: string, res: Response): void {
    const limit = res.headers.get('x-ratelimit-limit')
    const remaining = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    if (limit && remaining && reset) {
      this.rateLimits.set(path, {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      })
    }
  }
}
