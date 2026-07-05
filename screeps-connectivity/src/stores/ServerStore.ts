import { TypedStore } from './TypedStore.js'
import type { Logger } from '../logger.js'
import type { ServerStoreEvents } from '../types/events.js'
import type { ServerVersion, ShardInfo, WorldInfo } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'
import type { Subscription } from '../subscription/index.js'

export class ServerStore extends TypedStore<ServerStoreEvents> {
  private readonly http: HttpClient
  private readonly cache: Cache
  private readonly socketSubs: Subscription[] = []
  private _version: ServerVersion | null = null
  get versionInfo(): ServerVersion | null { return this._version }
  get isPrivateServer(): boolean | null {
    if (!this._version) return null
    return (this._version.serverData?.shards?.length ?? 0) === 0
  }
  private _shards: ShardInfo[] | null = null
  get shardList(): ShardInfo[] | null { return this._shards }

  constructor(http: HttpClient, socket: SocketClient, cache: Cache, logger?: Logger) {
    super(logger)
    this.http = http
    this.cache = cache

    this.socketSubs.push(socket.on('connected', () => {
      this.emit('server:connected', {})
    }))
    this.socketSubs.push(socket.on('disconnected', (data) => {
      const d = data as { willReconnect: boolean; intentional?: boolean }
      this.emit('server:disconnected', { willReconnect: d.willReconnect, intentional: d.intentional ?? false })
    }))
    this.socketSubs.push(socket.on('socket:error', (data) => {
      this.emit('server:error', { error: data instanceof Error ? data : new Error(String(data)) })
    }))
  }

  /** Release socket listeners owned by this store. Idempotent. */
  destroy(): void {
    for (const sub of this.socketSubs) sub.dispose()
    this.socketSubs.length = 0
  }

  async version(): Promise<ServerVersion> {
    const cached = this.cache.get<ServerVersion>('server/version')
    if (cached) return cached
    const res = await this.http.request<ServerVersion>('GET', '/api/version')
    this._version = res
    this.cache.set('server/version', res, 5 * 60_000)
    this.emit('server:version', res)
    return res
  }

  async refreshVersion(): Promise<ServerVersion> {
    this.cache.delete('server/version')
    return this.version()
  }

  async shards(): Promise<ShardInfo[]> {
    const cached = this.cache.get<ShardInfo[]>('server/shards')
    if (cached) return cached
    const res = await this.http.request<{ ok: number; shards: ShardInfo[] }>('GET', '/api/game/shards/info')
    this._shards = res.shards
    this.cache.set('server/shards', res.shards, 5 * 60_000)
    this.emit('server:shards', res.shards)
    return res.shards
  }

  async refreshShards(): Promise<ShardInfo[]> {
    this.cache.delete('server/shards')
    return this.shards()
  }

  async worldInfo(shard?: string): Promise<WorldInfo> {
    const shardKey = shard ?? 'default'
    const cacheKey = `server/world/${shardKey}`
    const cached = this.cache.get<WorldInfo>(cacheKey)
    if (cached) return cached

    const params: Record<string, string> = {}
    if (shard) params.shard = shard

    const size = await this.http.request<{ ok: number; width: number; height: number }>(
      'GET', '/api/game/world-size', params
    )
    const { width, height } = size
    this.logger.log(`worldInfo shard=${shard ?? 'none'} — raw size: ${width}x${height}`)

    // Start with W/N-only assumption (most common for private servers)
    // width/height = total rooms in that axis; W-only → all rooms are west of E0
    let minX = -width, maxX = -1, minY = -height, maxY = -1

    // Probe the four quadrant-origin rooms to detect which quadrants actually exist.
    // mapStats only returns entries for rooms that exist on the server.
    try {
      const probe = await this.http.request<{ ok: number; stats: Record<string, unknown> }>(
        'POST', '/api/game/map-stats',
        { rooms: ['W0N0', 'E0N0', 'W0S0', 'E0S0'], statName: 'owner0', ...params }
      )
      const stats = probe.stats ?? {}
      const found = (['W0N0', 'E0N0', 'W0S0', 'E0S0'] as const).filter(r => r in stats)
      this.logger.log(`worldInfo corner probe — found: [${found.length ? found.join(', ') : 'none'}]`)
      const hasEast  = 'E0N0' in stats || 'E0S0' in stats
      const hasWest  = 'W0N0' in stats || 'W0S0' in stats
      const hasSouth = 'W0S0' in stats || 'E0S0' in stats
      const hasNorth = 'W0N0' in stats || 'E0N0' in stats
      if (hasEast && hasWest) {
        // Both E and W quadrants exist: split width evenly around E0/W0
        minX = -Math.ceil(width / 2)
        maxX = Math.floor(width / 2) - 1
      } else if (hasEast) {
        // Only E quadrant: all rooms are east of E0
        minX = 0
        maxX = width - 1
      }
      // else: W-only keeps default (minX=-width, maxX=-1)
      if (hasSouth && hasNorth) {
        // Both S and N quadrants exist: split height evenly around S0/N0
        minY = -Math.ceil(height / 2)
        maxY = Math.floor(height / 2) - 1
      } else if (hasSouth) {
        // Only S quadrant: all rooms are south of S0
        minY = 0
        maxY = height - 1
      }
      // else: N-only keeps default (minY=-height, maxY=-1)
    } catch (e) {
      this.logger.log('worldInfo corner probe failed — keeping W/N defaults:', e)
    }

    this.logger.log(`worldInfo computed bounds — x: [${minX}, ${maxX}]  y: [${minY}, ${maxY}]`)
    const info: WorldInfo = { shard: shard ?? null, width, height, minX, maxX, minY, maxY }
    this.cache.set(cacheKey, info, 10 * 60_000)
    return info
  }

  invalidateWorldInfo(shard?: string): void {
    this.cache.delete(`server/world/${shard ?? 'default'}`)
  }
}
