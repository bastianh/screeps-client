import type { MapGraffiti, MapLandscape, MapRoomDecorations } from 'screeps-connectivity'
import { scaleHsl } from './hsl.js'

/**
 * Turns a room's world-map decorations into concrete render inputs.
 *
 * The saturation and brightness factors are the reference map layer's
 * (`@screeps/map/dist/layers/decorations/*`). It desaturates every layer so a decorated
 * room still reads as a map tile; a straight copy of the room-view colours would glare.
 *
 * One structural shortcut: the reference stacks a recoloured terrain bitmap per landscape
 * and masks each to walls or non-walls. We bake a single terrain bitmap per room with a
 * colour per terrain type, which produces the same picture for far less work.
 */

/** Terrain palette handed to the bake worker. CSS colour strings. */
export interface MapTerrainColors {
  plain?: string
  swamp?: string
  wall?: string
  road?: string
}

/** A landscape overlay texture stretched across the whole room. */
export interface MapTextureOverlay {
  url: string
  tint: number
  alpha: number
  /** Which terrain the texture is masked to. */
  target: 'floor' | 'wall'
}

/** A graffiti sprite, masked to the room's walls. Geometry in room cells. */
export interface MapGraffitiSprite {
  url: string
  tint?: number
  x: number
  y: number
  width: number
  height: number
  alpha: number
  tiling: boolean
  tileScale: number
}

export interface MapDecorationRender {
  colors: MapTerrainColors
  overlays: MapTextureOverlay[]
  graffiti: MapGraffitiSprite[]
}

function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16)
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Blend two packed colours channel-wise: `ratio` of `a`, the rest of `b`. */
function mix(a: number, b: number, ratio: number): number {
  const rest = 1 - ratio
  const r = ((a >> 16) & 0xff) * ratio + ((b >> 16) & 0xff) * rest
  const g = ((a >> 8) & 0xff) * ratio + ((b >> 8) & 0xff) * rest
  const bl = (a & 0xff) * ratio + (b & 0xff) * rest
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

function overlay(landscape: MapLandscape, target: 'floor' | 'wall', saturation: number): MapTextureOverlay | null {
  if (!landscape.foregroundUrl || !landscape.foregroundColor) return null
  return {
    url: landscape.foregroundUrl,
    tint: scaleHsl(hex(landscape.foregroundColor), saturation, 0.5 * landscape.foregroundBrightness),
    alpha: landscape.foregroundAlpha,
    target,
  }
}

function graffitiSprites(items: readonly MapGraffiti[]): MapGraffitiSprite[] {
  const out: MapGraffitiSprite[] = []
  for (const item of items) {
    // Unlit graffiti is dimmed and desaturated; a lit one keeps its own brightness.
    const saturation = item.lighting ? 1 : 0.25
    const lightness = item.lighting ? item.brightness : 0.5
    for (const graphic of item.graphics) {
      out.push({
        url: graphic.url,
        tint: graphic.color ? scaleHsl(hex(graphic.color), saturation, lightness) : undefined,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        alpha: item.alpha,
        tiling: item.tiling,
        tileScale: item.tileScale,
      })
    }
  }
  return out
}

export function buildMapDecoration(decorations: MapRoomDecorations): MapDecorationRender {
  const colors: MapTerrainColors = {}
  const overlays: MapTextureOverlay[] = []

  const { floor, wall } = decorations

  let plain: number | undefined
  if (floor?.backgroundColor) {
    plain = scaleHsl(hex(floor.backgroundColor), 0.5, 0.55 * floor.backgroundBrightness)
    colors.plain = css(plain)
  }
  if (floor?.swampColor) {
    // The reference mixes the *already desaturated* plain with the raw swamp colour.
    const swampRaw = hex(floor.swampColor)
    colors.swamp = css(plain != null ? mix(plain, swampRaw, 0.7) : swampRaw)
  }
  if (floor?.roadsColor) colors.road = floor.roadsColor

  if (wall?.backgroundColor) {
    colors.wall = css(scaleHsl(hex(wall.backgroundColor), 0.48, wall.backgroundBrightness))
  }

  if (floor) {
    const o = overlay(floor, 'floor', 0.35)
    if (o) overlays.push(o)
  }
  if (wall) {
    const o = overlay(wall, 'wall', 0.75)
    if (o) overlays.push(o)
  }

  return { colors, overlays, graffiti: graffitiSprites(decorations.graffiti) }
}
