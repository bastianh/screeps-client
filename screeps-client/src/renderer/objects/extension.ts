import { Container, Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_LIGHT, ST_ENERGY } from '../colors.js'
import { type VisualBuildContext } from './types.js'

// Extension visuals: scaled disc with an energy-fill core (also reused by spawn).
export const EXT_OUTER_R = TILE_SIZE * 0.42
export const EXT_INNER_R = TILE_SIZE * 0.30
export const EXT_STROKE_W = Math.max(1, TILE_SIZE * 0.08)

export function getExtensionEnergy(obj: RoomObject): { energy: number; capacity: number } {
  let capacity = 50
  if (typeof obj.energyCapacity === 'number') {
    capacity = obj.energyCapacity
  } else if (typeof obj.storeCapacity === 'number') {
    capacity = obj.storeCapacity
  } else if (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object') {
    const cap = obj.storeCapacityResource as Record<string, number>
    capacity = cap.energy ?? 50
  }

  let energy = 0
  if (typeof obj.energy === 'number') {
    energy = obj.energy
  } else if (obj.store && typeof obj.store === 'object') {
    const store = obj.store as Record<string, number>
    energy = store.energy ?? 0
  }

  return { energy, capacity }
}

export function extScale(capacity: number): number {
  if (capacity >= 200) return 1.15
  if (capacity >= 100) return 0.85
  return 0.70
}

export function calcExtensionFillRadius(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return EXT_INNER_R * extScale(capacity) * Math.min(1, energy / capacity)
}

export function drawExtensionVisual(container: Container, energy: number, capacity: number, outlineColor: number): void {
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const scale = extScale(capacity)
  const g = new Graphics()
  g.circle(cx, cy, EXT_OUTER_R * scale)
  g.fill(ST_DARK)
  g.circle(cx, cy, EXT_OUTER_R * scale)
  g.stroke({ width: EXT_STROKE_W * scale, color: outlineColor })
  g.circle(cx, cy, EXT_INNER_R * scale)
  g.fill(ST_LIGHT)
  container.addChild(g)

  const fill = new Graphics()
  const radius = calcExtensionFillRadius(energy, capacity)
  if (radius > 0) {
    fill.circle(cx, cy, radius)
    fill.fill(ST_ENERGY)
  }
  container.addChild(fill)
  ;(container as Container & { __fillGraphics?: Graphics }).__fillGraphics = fill
}

export function updateExtensionFill(visual: Container, radius: number): void {
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const fill = (visual as Container & { __fillGraphics?: Graphics }).__fillGraphics
  if (!fill) return
  fill.clear()
  if (radius > 0) {
    fill.circle(cx, cy, radius)
    fill.fill(ST_ENERGY)
  }
}
export function createExtensionVisual(ctx: VisualBuildContext): void {
  const { obj, container, outlineColor } = ctx
  const { energy, capacity } = getExtensionEnergy(obj)
  drawExtensionVisual(container, energy, capacity, outlineColor)
  ;(container as Container & { __extEnergy?: number; __extCapacity?: number }).__extEnergy = energy
  ;(container as Container & { __extEnergy?: number; __extCapacity?: number }).__extCapacity = capacity
}
