import { TypedStore } from './TypedStore.js'
import type { ServerStoreEvents } from '../types/events.js'
import type { ServerVersion, ShardInfo } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'

export class ServerStore extends TypedStore<ServerStoreEvents> {
  private readonly http: HttpClient
  private readonly cache: Cache

  constructor(http: HttpClient, socket: SocketClient, cache: Cache) {
    super()
    this.http = http
    this.cache = cache

    socket.on('connected', () => {
      this.emit('server:connected', {})
    })
    socket.on('disconnected', (data) => {
      const d = data as { willReconnect: boolean }
      this.emit('server:disconnected', { willReconnect: d.willReconnect })
    })
    socket.on('socket:error', (data) => {
      this.emit('server:error', { error: data instanceof Error ? data : new Error(String(data)) })
    })
  }

  async version(): Promise<ServerVersion> {
    const cached = this.cache.get<ServerVersion>('server/version')
    if (cached) return cached
    const res = await this.http.request<ServerVersion>('GET', '/api/version')
    this.cache.set('server/version', res, 5 * 60_000)
    return res
  }

  async shards(): Promise<ShardInfo[]> {
    const res = await this.http.request<{ ok: number; shards: ShardInfo[] }>('GET', '/api/game/shards/info')
    return res.shards
  }
}
