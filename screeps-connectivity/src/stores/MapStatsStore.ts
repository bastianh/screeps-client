import { TypedStore } from './TypedStore.js'
import type { Logger } from '../logger.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { ApiMapStatsRoomStat, ApiMapStatsBadge } from '../types/api.js'

/** Fixed stat names for the map-stats API (no interval parameter). */
export const MapStatName = {
  owner:    'owner0',
  minerals: 'minerals0',
  power:    'power0',
} as const

/** Stat name prefixes that take an interval suffix — combine with {@link MapStatInterval} via {@link mapStat}. */
export const MapStatPrefix = {
  energyControl:      'energyControl',
  energyHarvested:    'energyHarvested',
  energyConstruction: 'energyConstruction',
  energyCreeps:       'energyCreeps',
  creepsProduced:     'creepsProduced',
  creepsLost:         'creepsLost',
  powerProcessed:     'powerProcessed',
} as const

/** Tick-bucket intervals supported by the Screeps API for parameterised stats. */
export const MapStatInterval = {
  hour1:   8,
  hours24: 180,
  days7:   1440,
} as const

/** Build a parameterised stat name, e.g. `mapStat(MapStatPrefix.energyControl, MapStatInterval.hours24)` → `"energyControl180"`. */
export const mapStat = (prefix: string, interval: number): string => `${prefix}${interval}`

/** Custom terrain palette extracted from a room's active world-map decoration. */
export interface TerrainColors {
  plain?: string  // CSS color string, e.g. "#68DFFF"
  swamp?: string
  road?: string
}

export interface MapStatsRoomData {
  own?: { user: string; level: number }
  mineral?: string
  density?: number
  username?: string
  safeMode?: boolean
  badge?: ApiMapStatsBadge
  status?: string
  /**
   * Controller sign. `user` is the raw signer id; `username`/`badge` are resolved from the
   * response's user map and may be absent if the signer isn't included there.
   */
  sign?: { user: string; text: string; datetime: number; username?: string; badge?: ApiMapStatsBadge }
  /** Custom terrain colors from an active world-map decoration, if any. */
  terrainColors?: TerrainColors
}

export interface MapStatsStoreEvents {
  'mapStats:room': { room: string; shard: string | null; stat: MapStatsRoomData; statName: string }
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

        const shardKey = batch.shard === 'shard0' ? null : batch.shard
        for (const [room, stat] of Object.entries(res.stats)) {
          const data = this.buildData(stat, userMap)
          this.emit('mapStats:room', { room, shard: shardKey, stat: data, statName: batch.statName })
        }

        // Emit empty data for rooms that don't exist on server
        for (const room of allRooms) {
          if (!res.stats[room]) {
            this.emit('mapStats:room', { room, shard: shardKey, stat: {}, statName: batch.statName })
          }
        }
      } catch (err) {
        this.logger.log('mapStats fetch failed:', err)
      }
    }
  }

  private buildData(stat: ApiMapStatsRoomStat, userMap: Record<string, { username: string; badge: ApiMapStatsBadge }>): MapStatsRoomData {
    const mineral = stat.minerals0?.type
    const density = stat.minerals0?.density
    const ownerId = stat.own?.user
    const signUserId = stat.sign?.user

    // Find the terrain-theme decoration (world=true + floor/swamp color properties).
    const terrainDeco = stat.decorations?.find(d => d.active.world && (d.active.floorBackgroundColor || d.active.swampColor))
    const terrainColors: TerrainColors | undefined = terrainDeco ? {
      plain: terrainDeco.active.floorBackgroundColor,
      swamp: terrainDeco.active.swampColor,
      road: terrainDeco.active.roadsColor,
    } : undefined

    return {
      own: stat.own,
      mineral,
      density,
      username: ownerId ? userMap[ownerId]?.username : undefined,
      safeMode: stat.safeMode,
      badge: ownerId ? userMap[ownerId]?.badge : undefined,
      status: stat.status,
      sign: stat.sign
        ? {
            user: stat.sign.user,
            text: stat.sign.text,
            datetime: stat.sign.datetime,
            username: signUserId ? userMap[signUserId]?.username : undefined,
            badge: signUserId ? userMap[signUserId]?.badge : undefined,
          }
        : undefined,
      terrainColors,
    }
  }
}
