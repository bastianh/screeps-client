import { decompressGzip } from './decompress.js'
import type { AuthStrategy } from './auth/AuthStrategy.js'
import { createAuthEndpoints, type AuthEndpoints } from './endpoints/auth.js'
import { createGameEndpoints, type GameEndpoints } from './endpoints/game.js'
import { createUserEndpoints, type UserEndpoints } from './endpoints/user.js'
import { createLeaderboardEndpoints, type LeaderboardEndpoints } from './endpoints/leaderboard.js'
import { createExperimentalEndpoints, type ExperimentalEndpoints } from './endpoints/experimental.js'

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export class HttpClient {
  readonly baseUrl: string
  private readonly authStrategy: AuthStrategy
  token: string | null = null
  readonly rateLimits = new Map<string, RateLimitInfo>()
  private authenticating = false

  readonly auth: AuthEndpoints
  readonly game: GameEndpoints
  readonly user: UserEndpoints
  readonly leaderboard: LeaderboardEndpoints
  readonly experimental: ExperimentalEndpoints

  constructor(opts: { url: string; auth: AuthStrategy }) {
    this.baseUrl = opts.url.endsWith('/') ? opts.url : `${opts.url}/`
    this.authStrategy = opts.auth
    this.auth = createAuthEndpoints(this)
    this.game = createGameEndpoints(this)
    this.user = createUserEndpoints(this)
    this.leaderboard = createLeaderboardEndpoints(this)
    this.experimental = createExperimentalEndpoints(this)
  }

  async authenticate(): Promise<void> {
    this.authenticating = true
    try {
      this.token = await this.authStrategy.authenticate(this)
    } finally {
      this.authenticating = false
    }
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, isRetry = false): Promise<T> {
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.baseUrl)
    const headers: Record<string, string> = {}

    if (this.token) {
      headers['X-Token'] = this.token
      headers['X-Username'] = this.token
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

    const res = await fetch(url.toString(), init)

    const newToken = res.headers.get('x-token')
    if (newToken) this.token = newToken

    this.updateRateLimit(path, res)

    if (res.status === 401 && !isRetry && !this.authenticating) {
      await this.authenticate()
      return this.request<T>(method, path, body, true)
    }

    if (!res.ok) {
      let body = ''
      try { body = await res.text() } catch { /* ignore */ }
      throw new Error(`HTTP ${res.status}: ${body}`)
    }

    const data = await res.json() as Record<string, unknown>

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
