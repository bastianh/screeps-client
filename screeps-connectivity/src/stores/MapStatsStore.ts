import { TypedStore } from './TypedStore.js'
import type { Logger } from '../logger.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { ApiMapStatsRoomStat, ApiMapStatsBadge } from '../types/api.js'

export interface MapStatsRoomData {
  own?: { user: string; level: number }
  mineral?: string
  density?: number
  username?: string
  safeMode?: boolean
  badge?: ApiMapStatsBadge
  status?: string
}

export interface MapStatsStoreEvents {
  'mapStats:room': { room: string; shard: string | null; stat: MapStatsRoomData }
}

interface PendingBatch {
  rooms: Set<string>
  statName: string
  shard: string
}

export class MapStatsStore extends TypedStore<MapStatsStoreEvents> {
  private readonly http: HttpClient
  private readonly debounceMs: number
  private readonly minIntervalMs: number
  private pending = new Map<string, PendingBatch>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastFlushTime = 0

  constructor(http: HttpClient, debounceMs = 100, minIntervalMs = 500, logger?: Logger) {
    super(logger)
    this.http = http
    this.debounceMs = debounceMs
    this.minIntervalMs = minIntervalMs
  }

  /** Queue rooms for a batched mapStats fetch. No-op when rooms is empty. */
  request(rooms: string[], statName: string, shard?: string): void {
    if (rooms.length === 0) return

    const key = JSON.stringify([statName, shard ?? 'shard0'])
    let entry = this.pending.get(key)
    if (!entry) {
      entry = { rooms: new Set(), statName, shard: shard ?? 'shard0' }
      this.pending.set(key, entry)
    }
    for (const room of rooms) entry.rooms.add(room)

    if (this.timer) clearTimeout(this.timer)

    const now = Date.now()
    const timeSinceLastFlush = now - this.lastFlushTime
    const delay = Math.max(this.debounceMs, this.minIntervalMs - timeSinceLastFlush)

    this.timer = setTimeout(() => this.flush(), delay)
  }

  private async flush(): Promise<void> {
    const toFlush = new Map(this.pending)
    this.pending.clear()
    this.timer = null
    this.lastFlushTime = Date.now()

    for (const [, batch] of toFlush) {
      const allRooms = [...batch.rooms]
      try {
        const res = await this.http.request<{ ok: number; stats: Record<string, ApiMapStatsRoomStat>; users: Record<string, { _id: string; username: string; badge: ApiMapStatsBadge }> }>(
          'POST', '/api/game/map-stats', { rooms: allRooms, statName: batch.statName, shard: batch.shard }
        )

        const userMap = res.users ?? {}

        for (const [room, stat] of Object.entries(res.stats)) {
          const data = this.buildData(stat, userMap)
          this.emit('mapStats:room', { room, shard: batch.shard === 'shard0' ? null : batch.shard, stat: data })
        }

        // Emit empty data for rooms that don't exist on server
        for (const room of allRooms) {
          if (!res.stats[room]) {
            this.emit('mapStats:room', { room, shard: batch.shard === 'shard0' ? null : batch.shard, stat: {} })
          }
        }
      } catch (err) {
        this.logger.log('mapStats fetch failed:', err)
      }
    }
  }

  private buildData(stat: ApiMapStatsRoomStat, userMap: Record<string, { username: string; badge: ApiMapStatsBadge }>): MapStatsRoomData {
    let mineral: string | undefined
    let density: number | undefined
    for (let i = 0; i < 3; i++) {
      const mineralKey = `minerals${i}` as `minerals${number}`
      const mineralData = stat[mineralKey]
      if (mineralData) {
        mineral = mineralData.type
        density = mineralData.density
        break
      }
    }
    const ownerId = stat.own?.user
    return {
      own: stat.own,
      mineral,
      density,
      username: ownerId ? userMap[ownerId]?.username : undefined,
      safeMode: stat.safeMode,
      badge: ownerId ? userMap[ownerId]?.badge : undefined,
      status: stat.status,
    }
  }
}
