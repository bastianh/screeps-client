import { TypedStore } from './TypedStore.js'
import type { Logger } from '../logger.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { ApiMapStatsRoomStat, ApiMapStatsBadge, ApiMapStatsDecorationDef, ApiDecorationActive } from '../types/api.js'

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

/**
 * One landscape half of a room's world-map decoration, with the API's two naming schemes
 * (`floorBackgroundColor` vs `backgroundColor`) folded onto one shape. Values are raw —
 * the renderer owns the colour maths.
 */
export interface MapLandscape {
  backgroundColor?: string
  backgroundBrightness: number
  /** Floor half only. */
  swampColor?: string
  /** Floor half only. */
  roadsColor?: string
  foregroundUrl?: string
  foregroundColor?: string
  foregroundBrightness: number
  foregroundAlpha: number
}

/** One `wallGraffiti` on the world map. Geometry is in room cells. */
export interface MapGraffiti {
  x: number
  y: number
  width: number
  height: number
  tiling: boolean
  tileScale: number
  alpha: number
  lighting: boolean
  brightness: number
  /** `color` is the *name* of a colour prop on the decoration, already resolved to its value. */
  graphics: Array<{ url: string; color?: string }>
}

/** A room's active world-map decorations, resolved against the response's definitions. */
export interface MapRoomDecorations {
  floor?: MapLandscape
  wall?: MapLandscape
  graffiti: MapGraffiti[]
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
  /** Active world-map decorations, if any. */
  decorations?: MapRoomDecorations
}

function num(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

function bool(v: unknown): boolean {
  if (typeof v === 'string') return v !== '' && v !== '0' && v !== 'false'
  return !!v
}

/**
 * Which landscape halves does this item cover?
 *
 * The definition's type is authoritative when the response carried one — `landscape`
 * covers both halves. Servers that omit the `decorations` dictionary still work: the
 * colour props themselves say which half an item drives, and no other decoration type
 * carries them.
 */
function landscapeRoles(active: ApiDecorationActive, def?: ApiMapStatsDecorationDef): { floor: boolean; wall: boolean } {
  switch (def?.type) {
    case 'floorLandscape': return { floor: true, wall: false }
    case 'wallLandscape':  return { floor: false, wall: true }
    case 'landscape':      return { floor: true, wall: true }
    case undefined:        break
    default:               return { floor: false, wall: false }
  }
  return {
    floor: active.floorBackgroundColor != null || active.swampColor != null,
    wall: active.backgroundColor != null,
  }
}

function floorLandscape(active: ApiDecorationActive, def?: ApiMapStatsDecorationDef): MapLandscape {
  return {
    backgroundColor: str(active.floorBackgroundColor),
    backgroundBrightness: num(active.floorBackgroundBrightness, 1),
    swampColor: str(active.swampColor),
    roadsColor: str(active.roadsColor),
    foregroundUrl: str(def?.floorForegroundUrl),
    foregroundColor: str(active.floorForegroundColor),
    foregroundBrightness: num(active.floorForegroundBrightness, 1),
    foregroundAlpha: num(active.floorForegroundAlpha, 1),
  }
}

function wallLandscape(active: ApiDecorationActive, def?: ApiMapStatsDecorationDef): MapLandscape {
  return {
    backgroundColor: str(active.backgroundColor),
    backgroundBrightness: num(active.backgroundBrightness, 1),
    foregroundUrl: str(def?.foregroundUrl),
    foregroundColor: str(active.foregroundColor),
    foregroundBrightness: num(active.foregroundBrightness, 1),
    foregroundAlpha: num(active.foregroundAlpha, 1),
  }
}

function graffiti(active: ApiDecorationActive, def: ApiMapStatsDecorationDef): MapGraffiti {
  return {
    x: num(active.x, 0),
    y: num(active.y, 0),
    width: num(active.width, 1),
    height: num(active.height, 1),
    tiling: bool(def.tiling),
    tileScale: num(active.tileScale, 1),
    alpha: num(active.alpha, 1),
    lighting: bool(active.lighting),
    brightness: num(active.brightness, 1),
    graphics: (def.graphics ?? [])
      .filter(g => !g.visible || bool(active[g.visible]))
      .map(g => ({ url: g.url, color: g.color ? str(active[g.color]) : undefined })),
  }
}

/**
 * Collect a room's world-map decorations. Only items flagged `world` show on the map,
 * and — as in the reference renderer — only the first landscape of each half applies.
 */
export function buildRoomDecorations(
  stat: ApiMapStatsRoomStat,
  defs: Record<string, ApiMapStatsDecorationDef>,
): MapRoomDecorations | undefined {
  const items = stat.decorations?.filter(d => d.active.world)
  if (!items?.length) return undefined

  const out: MapRoomDecorations = { graffiti: [] }

  for (const item of items) {
    const def = defs[item.decoration]
    if (def?.type === 'wallGraffiti') {
      out.graffiti.push(graffiti(item.active, def))
      continue
    }
    const roles = landscapeRoles(item.active, def)
    if (roles.floor && !out.floor) out.floor = floorLandscape(item.active, def)
    if (roles.wall && !out.wall) out.wall = wallLandscape(item.active, def)
  }

  return out.floor || out.wall || out.graffiti.length > 0 ? out : undefined
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
        const res = await this.http.request<{ ok: number; stats: Record<string, ApiMapStatsRoomStat>; users: Record<string, { _id: string; username: string; badge: ApiMapStatsBadge }>; decorations?: Record<string, ApiMapStatsDecorationDef> }>(
          'POST', '/api/game/map-stats', { rooms: allRooms, statName: batch.statName, shard: batch.shard }
        )

        const userMap = res.users ?? {}
        const decorationDefs = res.decorations ?? {}

        const shardKey = batch.shard === 'shard0' ? null : batch.shard
        for (const [room, stat] of Object.entries(res.stats)) {
          const data = this.buildData(stat, userMap, decorationDefs)
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

  private buildData(
    stat: ApiMapStatsRoomStat,
    userMap: Record<string, { username: string; badge: ApiMapStatsBadge }>,
    defs: Record<string, ApiMapStatsDecorationDef>,
  ): MapStatsRoomData {
    const mineral = stat.minerals0?.type
    const density = stat.minerals0?.density
    const ownerId = stat.own?.user
    const signUserId = stat.sign?.user

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
      decorations: buildRoomDecorations(stat, defs),
    }
  }
}
