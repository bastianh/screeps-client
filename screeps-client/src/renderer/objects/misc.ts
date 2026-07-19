import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_ENERGY } from '../colors.js'
import { type VisualBuildContext } from './types.js'

// Simple visuals: dropped energy, batched road/wall/rampart placeholders, observer, invader core.
export function createEnergyVisual(ctx: VisualBuildContext): void {
  const { g, cx, cy } = ctx
  g.circle(cx, cy, TILE_SIZE * 0.2)
  g.fill(ST_ENERGY)
}
export function createRoadVisual(_ctx: VisualBuildContext): void {
  // Intentionally left empty: rendering is batched in ObjectLayer's roadGraphics
  // but we still need the empty container for selection tracking
}
export function createConstructedWallVisual(_ctx: VisualBuildContext): void {
  // Intentionally left empty: rendering is batched in ObjectLayer's wallGraphics
  // but we still need the empty container for selection tracking
}
export function createRampartVisual(_ctx: VisualBuildContext): void {
  // Intentionally left empty: rendering is batched in ObjectLayer's rampartGraphics
  // but we still need the empty container for selection tracking
}
export function createObserverVisual(ctx: VisualBuildContext): void {
  const { g, cx, cy, outlineColor } = ctx
  g.circle(cx, cy, TILE_SIZE * 0.45)
  g.fill(ST_DARK)
  g.circle(cx, cy, TILE_SIZE * 0.45)
  g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  g.circle(cx + TILE_SIZE * 0.225, cy, TILE_SIZE * 0.2)
  g.fill(outlineColor)
}
export function createInvaderCoreVisual(ctx: VisualBuildContext): void {
  const { g, cx, cy, outlineColor } = ctx
  g.circle(cx, cy, TILE_SIZE * 0.45)
  g.fill(ST_DARK)
  g.circle(cx, cy, TILE_SIZE * 0.45)
  g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  g.circle(cx, cy, TILE_SIZE * 0.35)
  g.fill(ST_GRAY)
}
