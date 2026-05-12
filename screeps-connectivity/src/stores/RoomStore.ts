import { TypedStore } from './TypedStore.js'
import { RoomTerrain } from '../types/game.js'
import type { RoomStoreEvents } from '../types/events.js'
import type { RoomObject, RoomObjectMap } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'
import type { Subscription } from '../subscription/index.js'

export class RoomStore extends TypedStore<RoomStoreEvents> {
  private readonly http: HttpClient
  private readonly socket: SocketClient
  private readonly cache: Cache
  private readonly roomObjects = new Map<string, RoomObjectMap>()
  private readonly roomSubCount = new Map<string, number>()

  constructor(http: HttpClient, socket: SocketClient, cache: Cache) {
    super()
    this.http = http
    this.socket = socket
    this.cache = cache
  }

  async terrain(room: string, shard: string): Promise<RoomTerrain> {
    const key = `terrain/${shard}/${room}`

    const cached = this.cache.get<RoomTerrain>(key)
    if (cached) return cached

    const persisted = await this.cache.getPersistent(key)
    if (persisted) {
      const terrain = new RoomTerrain(persisted)
      this.cache.set(key, terrain)
      return terrain
    }

    const res = await this.http.game.roomTerrain(room, shard)
    const entry = res.terrain[0]
    if (!entry) throw new Error(`No terrain data for room ${room} shard ${shard}`)
    const terrain = RoomTerrain.fromEncodedString(entry.terrain)

    this.cache.set(key, terrain)
    await this.cache.setPersistent(key, terrain.raw)
    this.emit('room:terrainavailable', { room, shard, terrain })

    return terrain
  }

  objects(room: string, shard: string): RoomObjectMap | null {
    return this.roomObjects.get(`${room}/${shard}`) ?? null
  }

  subscribe(room: string, shard: string): Subscription {
    const mapKey = `${room}/${shard}`
    const count = this.roomSubCount.get(mapKey) ?? 0
    this.roomSubCount.set(mapKey, count + 1)

    const channel = `room:${shard}/${room}`
    const socketSub = this.socket.subscribe(channel)

    const listenerSub = this.socket.on(channel, (data) => {
      const update = data as { objects: Record<string, Partial<RoomObject> | null>; gameTime: number }
      const current: RoomObjectMap = { ...(this.roomObjects.get(mapKey) ?? {}) }

      for (const [id, obj] of Object.entries(update.objects)) {
        if (obj === null) {
          delete current[id]
        } else if (current[id]) {
          current[id] = { ...current[id], ...obj } as RoomObject
        } else {
          current[id] = obj as RoomObject
        }
      }

      this.roomObjects.set(mapKey, current)
      this.emit('room:update', { room, shard, gameTime: update.gameTime, objects: current })
    })

    return {
      dispose: () => {
        socketSub.dispose()
        listenerSub.dispose()
        const remaining = (this.roomSubCount.get(mapKey) ?? 1) - 1
        if (remaining <= 0) {
          this.roomSubCount.delete(mapKey)
          this.roomObjects.delete(mapKey)
        } else {
          this.roomSubCount.set(mapKey, remaining)
        }
      },
    }
  }
}
