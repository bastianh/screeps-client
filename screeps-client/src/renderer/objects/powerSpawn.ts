import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_ENERGY, ST_POWER } from '../colors.js'
import { calcCenterFillFraction } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Power-spawn visuals: red-ringed disc with an energy core and a power arc meter.
// Power spawn: a red arc that sweeps clockwise from the top as stored power grows, mirroring
// the vanilla power meter. It rides the dark moat between the energy core (r 0.4) and the red
// structure ring (r 0.65). Energy stays the static yellow core drawn on the body.
export const POWER_SPAWN_POWER_CAP = 100   // POWER_SPAWN_POWER_CAPACITY fallback when caps are omitted
export const PS_POWER_ARC_R = TILE_SIZE * 0.51
export const PS_POWER_ARC_W = TILE_SIZE * 0.12

export function getPowerSpawnPower(obj: RoomObject): { power: number; powerCap: number } {
  const store = (obj.store && typeof obj.store === 'object') ? obj.store as Record<string, number> : {}
  const caps = (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object')
    ? obj.storeCapacityResource as Record<string, number> : {}
  const power = typeof store.power === 'number' ? store.power : 0
  const powerCap = typeof caps.power === 'number' ? caps.power : POWER_SPAWN_POWER_CAP
  return { power, powerCap }
}

export function drawPowerSpawnPower(g: Graphics, fraction: number): void {
  g.clear()
  if (fraction <= 0) return
  const c = TILE_SIZE / 2
  if (fraction >= 1) {
    g.circle(c, c, PS_POWER_ARC_R)
  } else {
    const start = -Math.PI / 2  // top
    const end = start + fraction * Math.PI * 2  // sweep clockwise (y-down)
    g.moveTo(c + PS_POWER_ARC_R * Math.cos(start), c + PS_POWER_ARC_R * Math.sin(start))
    g.arc(c, c, PS_POWER_ARC_R, start, end)
  }
  g.stroke({ width: PS_POWER_ARC_W, color: ST_POWER })
}

export function updatePowerSpawnPower(visual: ContainerWithTarget, fraction: number): void {
  if (visual.__powerSpawnPowerG) drawPowerSpawnPower(visual.__powerSpawnPowerG, fraction)
}
export function createPowerSpawnVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy } = ctx
  g.circle(cx, cy, TILE_SIZE * 0.65)
  g.fill(ST_DARK)
  g.circle(cx, cy, TILE_SIZE * 0.65)
  g.stroke({ width: TILE_SIZE * 0.1, color: ST_POWER })
  g.circle(cx, cy, TILE_SIZE * 0.4)
  g.fill(ST_ENERGY)
  // Power meter rides above the body `g` (added after the switch); sort children so the
  // arc renders over the dark moat. ObjectLayer.update() drives the sweep per-tick.
  container.sortableChildren = true
  const powerG = new Graphics()
  powerG.zIndex = 1
  const { power, powerCap } = getPowerSpawnPower(obj)
  drawPowerSpawnPower(powerG, calcCenterFillFraction(power, powerCap))
  container.addChild(powerG)
  const cwt = container as ContainerWithTarget
  cwt.__powerSpawnPowerG = powerG
  cwt.__powerSpawnPower = power
  cwt.__powerSpawnPowerCap = powerCap
}
