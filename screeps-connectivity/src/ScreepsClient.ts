import { HttpClient } from './http/HttpClient.js'
import { SocketClient } from './socket/SocketClient.js'
import { Cache } from './cache/Cache.js'
import { RoomStore } from './stores/RoomStore.js'
import { UserStore } from './stores/UserStore.js'
import { ServerStore } from './stores/ServerStore.js'
import { MapStore } from './stores/MapStore.js'
import { MapStatsStore } from './stores/MapStatsStore.js'
import { NavigationStore } from './stores/NavigationStore.js'
import { Map2Storage } from './cache/Map2Storage.js'
import { Logger } from './logger.js'
import type { LogFn } from './logger.js'
import type { AuthStrategy } from './http/auth/AuthStrategy.js'
import type { StorageAdapter } from './storage/StorageAdapter.js'
import type { Subscription } from './subscription/index.js'
import type { ApiRoomDecorationsResponse } from './types/api.js'

type WsConstructor = typeof globalThis.WebSocket

export interface TokenRefreshOptions {
  /** Interval in milliseconds between world-status polls. Default 30_000. */
  intervalMs?: number
}

export interface ScreepsClientOptions {
  url: string
  auth: AuthStrategy
  storage?: StorageAdapter | null
  WebSocket?: WsConstructor
  debug?: boolean | LogFn
  /** Required when the server is started with `SERVER_PASSWORD`. Sent as `X-Server-Password` on every HTTP request. */
  serverPassword?: string
  map2?: {
    maxSubscriptions?: number
    maxCacheEntries?: number
  }
  /**
   * Polls `/api/user/world-status` on a fixed interval to keep world status current.
   * Default `{ intervalMs: 30_000 }`. Pass `false` to disable.
   */
  tokenRefresh?: TokenRefreshOptions | false
  /** Override the /api/game/room-decorations response with static data (useful for dev/testing when the server doesn't support the endpoint). */
  decorationsMock?: ApiRoomDecorationsResponse
}

export class ScreepsClient {
  readonly http: HttpClient
  readonly socket: SocketClient
  readonly stores: {
    readonly room: RoomStore
    readonly user: UserStore
    readonly server: ServerStore
    readonly map: MapStore
    readonly mapStats: MapStatsStore
    readonly navigation: NavigationStore
  }
  private readonly cache: Cache
  private readonly logger: Logger
  private readonly tokenRefreshIntervalMs: number | null
  private readonly tokenSyncSubs: Subscription[] = []
  private tokenRefreshTimer: ReturnType<typeof setInterval> | null = null
  private refreshInFlight = false

  constructor(opts: ScreepsClientOptions) {
    let namespace: string
    try {
      namespace = new URL(opts.url).hostname
    } catch {
      throw new TypeError(`ScreepsClient: invalid url "${opts.url}"`)
    }
    this.logger = Logger.create(opts.debug)
    this.logger.log(`[screeps:client] init ${opts.url}`)
    this.cache = new Cache(namespace, opts.storage ?? null)
    this.http = new HttpClient({ url: opts.url, auth: opts.auth, logger: this.logger.child('http'), serverPassword: opts.serverPassword, decorationsMock: opts.decorationsMock })
    this.socket = new SocketClient({ url: opts.url, WebSocket: opts.WebSocket, logger: this.logger.child('socket') })
    const map2Storage = new Map2Storage({
      adapter: opts.storage ?? null,
      namespace,
      maxEntries: opts.map2?.maxCacheEntries ?? 10000,
    })
    this.stores = {
      room: new RoomStore(this.http, this.socket, this.cache, this.logger.child('room')),
      user: new UserStore(this.http, this.socket, this.cache, this.logger.child('user')),
      server: new ServerStore(this.http, this.socket, this.cache, this.logger.child('server')),
      map: new MapStore(this.socket, map2Storage, { maxSubscriptions: opts.map2?.maxSubscriptions ?? 500 }, this.logger.child('map')),
      mapStats: new MapStatsStore(this.http, 100, 500, this.logger.child('mapStats')),
      navigation: new NavigationStore(50, this.logger.child('navigation')),
    }

    this.tokenRefreshIntervalMs = opts.tokenRefresh === false
      ? null
      : (opts.tokenRefresh?.intervalMs ?? 30_000)

    this.wireTokenSync(opts.auth.supportsTokenRefresh ?? true)
  }

  private wireTokenSync(supportsRefresh: boolean): void {
    if (supportsRefresh) {
      // HTTP rotates token via X-Token → propagate to WS so a later reconnect uses the fresh one.
      this.tokenSyncSubs.push(this.http.on('http:tokenRefresh', ({ token }) => {
        this.socket.setToken(token)
      }))
      // WS issues a new token on auth → keep HTTP side in sync.
      this.tokenSyncSubs.push(this.socket.on('socket:tokenRefresh', (data) => {
        const detail = data as { token: string }
        this.http.setToken(detail.token)
      }))
    }
  }

  get isConnected(): boolean {
    return this.socket.isConnected
  }

  async connect(): Promise<void> {
    this.logger.log('[screeps:client] connect')
    await this.http.authenticate()
    await this.socket.connect(this.http.token!)
    await Promise.all([
      this.stores.user.me(),
      this.stores.user.worldStatus(),
      this.stores.server.version(),
    ])
    this.startTokenRefresh()
  }

  disconnect(): void {
    this.logger.log('[screeps:client] disconnect')
    this.stopTokenRefresh()
    this.socket.disconnect()
  }

  private startTokenRefresh(): void {
    if (this.tokenRefreshIntervalMs === null) return
    if (this.tokenRefreshTimer !== null) return
    this.tokenRefreshTimer = setInterval(() => {
      void this.refreshTokenNow()
    }, this.tokenRefreshIntervalMs)
  }

  private stopTokenRefresh(): void {
    if (this.tokenRefreshTimer !== null) {
      clearInterval(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }
  }

  private async refreshTokenNow(): Promise<void> {
    if (this.refreshInFlight) return
    this.refreshInFlight = true
    try {
      this.logger.log('[screeps:client] world status refresh')
      await this.stores.user.refreshWorldStatus()
    } catch (err) {
      this.logger.log('[screeps:client] world status refresh failed', err)
    } finally {
      this.refreshInFlight = false
    }
  }

  async clearCache(): Promise<void> {
    this.logger.log('[screeps:client] clearCache')
    await this.cache.clearAll()
  }
}
