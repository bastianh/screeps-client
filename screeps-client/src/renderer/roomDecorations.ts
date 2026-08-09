import type {
  ApiRoomDecorationActive,
  ApiRoomDecorationDef,
  ApiRoomDecorationItem,
} from 'screeps-connectivity'
import type { TerrainDecoration } from './TerrainLayer.js'
import { colorBrightness, multiply } from './hsl.js'

/** Alpha animation presets of the reference renderer (`src/lib/decorations.js`). */
export type DecorationAnimation = 'slow' | 'fast' | 'blink' | 'neon' | 'flash'

const ANIMATIONS: readonly string[] = ['slow', 'fast', 'blink', 'neon', 'flash']

/**
 * Cell size of the reference renderer's coordinate space. `wallGraffiti` sizes arrive in
 * cells, but `creep` and `object` sizes arrive in these pixels (a 256 means 2.56 cells),
 * so those are divided by this to give every decoration type a size in cells.
 */
export const REFERENCE_CELL_SIZE = 100

/**
 * Empirical brightness compensation for decoration-sourced landscape texture tints.
 *
 * Our ambient/lighting multiply renders noticeably darker than the reference — the same gap
 * that needed `TERRAIN_ROAD` hand-brightened by this same ratio (0x6B6969 → 0x8C8A8A) to read
 * correctly against the terrain. Landscape texture tints come straight from the API with no
 * such compensation, so a subtle, low-contrast pattern (e.g. a mostly-transparent overlay with
 * flat-grey opaque pixels) washes out under the same lighting.
 *
 * Applied as a straight `multiply()` on the RGB channels — like the `TERRAIN_ROAD` fix it
 * mirrors — not as an HSL-lightness scale: `colorBrightness` pushes lightness toward 1, and
 * these decoration tints (e.g. `#5CDCFF`) already sit at high lightness, so scaling lightness
 * further washes the hue out to near-white instead of just brightening it.
 */
const DECORATION_TEXTURE_BRIGHTNESS_BOOST = 0x8c / 0x6b

/** One sprite of a decoration, with the `graphics[]` prop references already resolved. */
export interface DecorationSprite {
  url: string
  /** Resolved tint, or undefined to leave the texture untinted. */
  tint?: number
  alpha: number
  tiling: boolean
  tileScale: number
}

interface DecorationBase {
  id: string
  /** Owner of the decoration — creep/object overlays only apply to their own objects. */
  user: string
  sprites: DecorationSprite[]
  /** Size in room cells, whatever unit the API used. */
  width: number
  height: number
  alpha: number
  /** Radians, as delivered by the API (the official UI shows degrees). */
  rotation: number
  flip: boolean
  lighting: boolean
  animation?: DecorationAnimation
}

/** `wallGraffiti` — a free image masked to the room's walls. Position in room cells. */
export interface GraffitiDecoration extends DecorationBase {
  x: number
  y: number
}

/** `creep` — overlay on the owner's creeps matching `nameFilter`. */
export interface CreepDecoration extends DecorationBase {
  /**
   * Already split on the API's `!SEP!` separator. Empty means "every creep": the
   * reference splits the raw string, so an empty filter yields `['']` and
   * `name.includes('')` matches everything — see `creepMatchesDecoration`.
   */
  nameFilter: string[]
  /** Invert the name filter: decorate everything *except* the matches. */
  exclude: boolean
  /** Attach to the rotating creep container instead of the room root. */
  syncRotate: boolean
  /** `position === 'below'` — draw under the creep instead of in the effects layer. */
  below: boolean
}

/** `object` — overlay on every object of `objectType`. */
export interface ObjectDecoration extends DecorationBase {
  objectType: string
}

/**
 * Does this creep decoration apply to `name`?
 *
 * An empty filter matches every creep, which falls out of how the reference splits the
 * raw `!SEP!` string: `''.split('!SEP!')` is `['']` and `name.includes('')` is always true.
 * `exclude` inverts the result, so an empty filter plus `exclude` matches nothing.
 */
export function creepMatchesDecoration(decoration: CreepDecoration, name: string): boolean {
  const matched = decoration.nameFilter.length === 0 || decoration.nameFilter.some(f => name.includes(f))
  return decoration.exclude ? !matched : matched
}

/** Parsed room decorations ready for use by renderer layers. */
export interface RoomDecoration {
  terrain?: TerrainDecoration
  roadColor?: number
  graffiti: GraffitiDecoration[]
  creeps: CreepDecoration[]
  objects: ObjectDecoration[]
}

function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16)
}

/** API returns some numeric fields as strings — normalise to number. */
function num(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

/** API returns some booleans as `'0'` / `'1'` strings. */
function bool(v: unknown): boolean {
  if (typeof v === 'string') return v !== '' && v !== '0' && v !== 'false'
  return !!v
}

function tinted(color: unknown, brightness: number): number | undefined {
  return typeof color === 'string' && color !== '' ? colorBrightness(hex(color), brightness) : undefined
}

/**
 * Convert a landscape `strokeWidth` / `swampStrokeWidth` into a fraction of a tile.
 *
 * The reference feeds these straight into an SVG whose viewBox is `VIEW_BOX` units for the
 * whole room, so one unit is 1/100 of a tile. It also sets `paint-order: stroke`, which
 * paints the stroke *under* the fill — and an SVG stroke is centred on the path, so only
 * its outer half survives. Our strokes are drawn with Pixi's `alignment: 0` (outside), so
 * the whole width shows and the reference's visible halo is `strokeWidth / 2` units.
 */
function borderWidth(strokeWidth: number): number {
  return strokeWidth / (2 * REFERENCE_CELL_SIZE)
}

/**
 * Tile scale of a landscape overlay, or `undefined` to stretch one copy over the room.
 *
 * The reference branches on — and reads — `decoration.tileScale`, the *definition* value,
 * ignoring any `tileScale` the placement exposes as an editable prop. Keying off the
 * placement instead would let a pack silently flip between tiled and stretched.
 */
function landscapeTileScale(d: ApiRoomDecorationDef): number | undefined {
  const scale = num(d.tileScale, 0)
  return scale > 0 ? scale : undefined
}

/**
 * Build the sprite list of a decoration. The `color` / `alpha` / `visible` fields of a
 * `graphics[]` entry hold *names* of props on `active`, not values.
 */
function resolveSprites(a: ApiRoomDecorationActive, d: ApiRoomDecorationDef): DecorationSprite[] {
  const brightness = num(a.brightness, 1)
  const tiling = bool(d.tiling)
  const tileScale = num(a.tileScale ?? d.tileScale, 1)
  const sprites: DecorationSprite[] = []

  for (const graphic of d.graphics ?? []) {
    if (graphic.visible && !bool(a[graphic.visible])) continue
    sprites.push({
      url: graphic.url,
      tint: graphic.color ? tinted(a[graphic.color], brightness) : undefined,
      alpha: graphic.alpha ? num(a[graphic.alpha], 1) : 1,
      tiling,
      tileScale,
    })
  }
  return sprites
}

function parseBase(item: ApiRoomDecorationItem, sizeScale = 1): DecorationBase {
  const a = item.active
  const animation = typeof a.animation === 'string' && ANIMATIONS.includes(a.animation)
    ? a.animation as DecorationAnimation
    : undefined

  return {
    id: item._id,
    user: item.user,
    sprites: resolveSprites(a, item.decoration),
    width: num(a.width, 1) * sizeScale,
    height: num(a.height, 1) * sizeScale,
    alpha: num(a.alpha, 1),
    rotation: num(a.rotation, 0),
    flip: bool(a.flip),
    lighting: bool(a.lighting),
    animation,
  }
}

function parseGraffiti(item: ApiRoomDecorationItem): GraffitiDecoration {
  return { ...parseBase(item), x: num(item.active.x, 0), y: num(item.active.y, 0) }
}

function parseCreep(item: ApiRoomDecorationItem): CreepDecoration {
  const a = item.active
  const filter = typeof a.nameFilter === 'string' ? a.nameFilter : ''
  return {
    ...parseBase(item, 1 / REFERENCE_CELL_SIZE),
    nameFilter: filter.split('!SEP!').filter(s => s !== ''),
    exclude: bool(a.exclude),
    syncRotate: bool(a.syncRotate),
    below: a.position === 'below',
  }
}

function parseObject(item: ApiRoomDecorationItem): ObjectDecoration {
  const objectType = item.decoration.objectType
  return {
    ...parseBase(item, 1 / REFERENCE_CELL_SIZE),
    objectType: typeof objectType === 'string' ? objectType : '',
  }
}

function parseFloorLandscape(a: ApiRoomDecorationActive, d: ApiRoomDecorationDef, out: RoomDecoration): void {
  const t: TerrainDecoration = out.terrain ?? {}
  if (a.floorBackgroundColor) {
    t.floorColor = colorBrightness(hex(a.floorBackgroundColor), num(a.floorBackgroundBrightness, 1))
  }
  if (a.swampColor)       t.swampFillColor   = hex(a.swampColor)
  if (a.swampStrokeColor) t.swampBorderColor = hex(a.swampStrokeColor)
  if (a.swampStrokeWidth != null) {
    t.swampBorderWidth = borderWidth(num(a.swampStrokeWidth, 50))
  }
  if (a.roadsColor) {
    out.roadColor = colorBrightness(hex(a.roadsColor), num(a.roadsBrightness, 1))
  }
  if (d.floorForegroundUrl) {
    t.floorTextureUrl = d.floorForegroundUrl
    if (a.floorForegroundColor) {
      t.floorTextureTint = multiply(
        colorBrightness(hex(a.floorForegroundColor), num(a.floorForegroundBrightness, 1)),
        DECORATION_TEXTURE_BRIGHTNESS_BOOST,
      )
    }
    t.floorTextureAlpha = num(a.floorForegroundAlpha, 1)
    t.floorTextureTileScale = landscapeTileScale(d)
  }
  out.terrain = t
}

function parseWallLandscape(a: ApiRoomDecorationActive, d: ApiRoomDecorationDef, out: RoomDecoration): void {
  const t: TerrainDecoration = out.terrain ?? {}
  if (a.backgroundColor) {
    t.wallFillColor = colorBrightness(hex(a.backgroundColor), num(a.backgroundBrightness, 1))
  }
  if (a.strokeColor) {
    t.wallBorderColor = colorBrightness(hex(a.strokeColor), num(a.strokeBrightness, 1))
  }
  if (a.strokeWidth != null) {
    t.wallBorderWidth = borderWidth(num(a.strokeWidth, 10))
  }
  if (a.strokeLighting != null) {
    t.wallBorderLighting = num(a.strokeLighting, 0)
  }
  if (d.foregroundUrl) {
    t.wallTextureUrl = d.foregroundUrl
    if (a.foregroundColor) {
      t.wallTextureTint = multiply(
        colorBrightness(hex(a.foregroundColor), num(a.foregroundBrightness, 1)),
        DECORATION_TEXTURE_BRIGHTNESS_BOOST,
      )
    }
    t.wallTextureAlpha = num(a.foregroundAlpha, 1)
  }
  out.terrain = t
}

/**
 * Merge decoration items delivered over the room socket into the list fetched over HTTP.
 *
 * Returns `current` untouched when nothing actually differs, so a server that repeats the
 * same payload every tick doesn't churn the renderer — that stability is why the reference
 * client dedupes by `_id` at all. Unlike the reference, which skips any `_id` it already
 * knows, a genuinely changed item replaces its predecessor so edits show up without a reload.
 */
export function mergeDecorationItems(
  current: readonly ApiRoomDecorationItem[],
  incoming: readonly ApiRoomDecorationItem[],
): readonly ApiRoomDecorationItem[] {
  const merged = [...current]
  const indexById = new Map(current.map((item, i) => [item._id, i]))
  let changed = false

  for (const item of incoming) {
    const at = indexById.get(item._id)
    if (at === undefined) {
      indexById.set(item._id, merged.length)
      merged.push(item)
      changed = true
    } else if (JSON.stringify(merged[at]) !== JSON.stringify(item)) {
      // Both sides come from the same server serialisation, so key order is stable.
      merged[at] = item
      changed = true
    }
  }

  return changed ? merged : current
}

/**
 * Convert raw /api/game/room-decorations items into renderer-ready values.
 *
 * Landscapes are first-wins, matching the reference renderer's `decorations.find(...)`:
 * only one floor and one wall landscape take effect per room, and the combined
 * `landscape` type counts as both. Graffiti, creep and object overlays are collected
 * as lists — a room may carry any number of them.
 */
export function parseRoomDecorations(items: readonly ApiRoomDecorationItem[]): RoomDecoration {
  const out: RoomDecoration = { graffiti: [], creeps: [], objects: [] }

  const floor = items.find(i => i.decoration.type === 'floorLandscape' || i.decoration.type === 'landscape')
  if (floor) parseFloorLandscape(floor.active, floor.decoration, out)

  const wall = items.find(i => i.decoration.type === 'wallLandscape' || i.decoration.type === 'landscape')
  if (wall) parseWallLandscape(wall.active, wall.decoration, out)

  for (const item of items) {
    switch (item.decoration.type) {
      case 'wallGraffiti': out.graffiti.push(parseGraffiti(item)); break
      case 'creep':        out.creeps.push(parseCreep(item)); break
      case 'object':       out.objects.push(parseObject(item)); break
    }
  }

  return out
}
