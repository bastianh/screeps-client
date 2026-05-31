import type { ApiRoomDecorationsResponse, ApiRoomDecorationActive, ApiRoomDecorationDef } from 'screeps-connectivity'
import type { TerrainDecoration } from './TerrainLayer.js'

/** Parsed room decoration ready for use by renderer layers. */
export interface RoomDecoration {
  terrain?: TerrainDecoration
  roadColor?: number
}

/** Multiply RGB channels by a brightness factor (matches reference renderer colorBrightness). */
function applyBrightness(hex: string, brightness: number): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) * brightness))
  const g = Math.min(255, Math.round(((n >> 8)  & 0xff) * brightness))
  const b = Math.min(255, Math.round(( n         & 0xff) * brightness))
  return (r << 16) | (g << 8) | b
}

function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16)
}

/** API returns some numeric fields as strings — normalise to number. */
function num(v: number | string | undefined, fallback: number): number {
  if (v == null) return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

function parseFloorLandscape(a: ApiRoomDecorationActive, d: ApiRoomDecorationDef, out: RoomDecoration): void {
  const t: TerrainDecoration = out.terrain ?? {}
  if (a.floorBackgroundColor) {
    t.floorColor = applyBrightness(a.floorBackgroundColor, num(a.floorBackgroundBrightness, 1))
  }
  if (a.swampColor)       t.swampFillColor   = hex(a.swampColor)
  if (a.swampStrokeColor) t.swampBorderColor = hex(a.swampStrokeColor)
  if (a.swampStrokeWidth != null) {
    // Reference renderer uses SVG units where CELL_SIZE=50; 50 units ≈ 0.20 * TILE_SIZE visually.
    // Empirical ratio: divide by 250 to convert to our fraction-of-TILE_SIZE scale.
    t.swampBorderWidth = num(a.swampStrokeWidth, 50) / 250
  }
  if (a.roadsColor) {
    out.roadColor = applyBrightness(a.roadsColor, num(a.roadsBrightness, 1))
  }
  if (d.floorForegroundUrl) {
    t.floorTextureUrl = d.floorForegroundUrl
    if (a.floorForegroundColor) {
      t.floorTextureTint = applyBrightness(a.floorForegroundColor, num(a.floorForegroundBrightness, 1))
    }
    t.floorTextureAlpha = num(a.floorForegroundAlpha, 1)
    t.floorTextureTileScale = num((a as Record<string, unknown>)['tileScale'] as number | string | undefined ?? d.tileScale, 1)
  }
  out.terrain = t
}

function parseWallLandscape(a: ApiRoomDecorationActive, d: ApiRoomDecorationDef, out: RoomDecoration): void {
  const t: TerrainDecoration = out.terrain ?? {}
  if (a.backgroundColor) {
    t.wallFillColor = applyBrightness(a.backgroundColor, num(a.backgroundBrightness, 1))
  }
  if (a.strokeColor) {
    t.wallBorderColor = applyBrightness(a.strokeColor, num(a.strokeBrightness, 1))
  }
  if (a.strokeWidth != null) {
    t.wallBorderWidth = num(a.strokeWidth, 10) / 250
  }
  if (d.foregroundUrl) {
    t.wallTextureUrl = d.foregroundUrl
    if (a.foregroundColor) {
      t.wallTextureTint = applyBrightness(a.foregroundColor, num(a.foregroundBrightness, 1))
    }
    t.wallTextureAlpha = num(a.foregroundAlpha, 1)
    t.wallTextureTileScale = num((a as Record<string, unknown>)['tileScale'] as number | string | undefined ?? d.tileScale, 1)
  }
  out.terrain = t
}

/**
 * Convert a raw /api/game/room-decorations response into renderer-ready values.
 * Handles floorLandscape (floor/swamp/road colors) and wallLandscape (wall colors).
 * wallGraffiti / creep / object overlays are left for future work.
 */
export function parseRoomDecorations(response: ApiRoomDecorationsResponse): RoomDecoration {
  const out: RoomDecoration = {}
  for (const item of response.decorations) {
    const type = item.decoration.type
    if (type === 'floorLandscape')  parseFloorLandscape(item.active, item.decoration, out)
    else if (type === 'wallLandscape') parseWallLandscape(item.active, item.decoration, out)
  }
  return out
}
