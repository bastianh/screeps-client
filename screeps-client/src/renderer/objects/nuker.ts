import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_ENERGY } from '../colors.js'
import { calcCenterFillFraction, resourceColor, spts } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Nuker visuals: rocket silhouette with energy triangle and ghodium bar fills.
// Nuker: energy fills the inner triangle bottom→top; ghodium fills a bar across the base.
export const NUKER_ENERGY_CAP_FALLBACK = 300000
export const NUKER_GHODIUM_CAP = 5000
export const NUKER_TRI_APEX_Y = -0.8
export const NUKER_TRI_BASE_Y = 0.2
export const NUKER_TRI_HALF   = 0.4
export const NUKER_BAR_X0 = -0.34, NUKER_BAR_X1 = 0.34, NUKER_BAR_Y0 = 0.27, NUKER_BAR_Y1 = 0.45

export function getNukerContents(obj: RoomObject): {
  energy: number; energyCap: number; ghodium: number; ghodiumCap: number
} {
  const store = (obj.store && typeof obj.store === 'object') ? obj.store as Record<string, number> : {}
  const caps = (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object')
    ? obj.storeCapacityResource as Record<string, number> : {}
  const energy = typeof store.energy === 'number' ? store.energy : 0
  const energyCap = typeof caps.energy === 'number' ? caps.energy
    : typeof obj.storeCapacity === 'number' ? obj.storeCapacity : NUKER_ENERGY_CAP_FALLBACK
  const ghodium = typeof store.G === 'number' ? store.G : 0
  const ghodiumCap = typeof caps.G === 'number' ? caps.G : NUKER_GHODIUM_CAP
  return { energy, energyCap, ghodium, ghodiumCap }
}

export function updateNukerFill(visual: ContainerWithTarget, energyFraction: number, ghodiumFraction: number): void {
  const c = TILE_SIZE / 2
  const tri = visual.__nukerEnergyG
  if (tri) {
    tri.clear()
    if (energyFraction > 0) {
      const span = NUKER_TRI_BASE_Y - NUKER_TRI_APEX_Y
      const topY = NUKER_TRI_BASE_Y - span * energyFraction
      const halfAt = NUKER_TRI_HALF * (topY - NUKER_TRI_APEX_Y) / span
      tri.poly([
        c + halfAt * TILE_SIZE, c + topY * TILE_SIZE,
        c + NUKER_TRI_HALF * TILE_SIZE, c + NUKER_TRI_BASE_Y * TILE_SIZE,
        c - NUKER_TRI_HALF * TILE_SIZE, c + NUKER_TRI_BASE_Y * TILE_SIZE,
        c - halfAt * TILE_SIZE, c + topY * TILE_SIZE,
      ])
      tri.fill(ST_ENERGY)
    }
  }
  const bar = visual.__nukerGhodiumG
  if (bar) {
    bar.clear()
    if (ghodiumFraction > 0) {
      const x = c + NUKER_BAR_X0 * TILE_SIZE
      const y = c + NUKER_BAR_Y0 * TILE_SIZE
      const w = (NUKER_BAR_X1 - NUKER_BAR_X0) * TILE_SIZE
      const h = (NUKER_BAR_Y1 - NUKER_BAR_Y0) * TILE_SIZE
      bar.rect(x, y, w * ghodiumFraction, h)
      bar.fill(resourceColor('G'))
    }
  }
}
export function createNukerVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, outlineColor } = ctx
  const nukerOuter = spts(cx, cy, [
    [0, -1], [-0.47, 0.2], [-0.5, 0.5], [0.5, 0.5], [0.47, 0.2], [0, -1],
  ])
  const nukerInner = spts(cx, cy, [
    [0, -0.8], [-0.4, 0.2], [0.4, 0.2], [0, -0.8],
  ])
  g.poly(nukerOuter)
  g.fill(ST_DARK)
  g.poly(nukerOuter)
  g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  g.poly(nukerInner)
  g.fill(ST_GRAY)
  g.poly(nukerInner)
  g.stroke({ width: TILE_SIZE * 0.01, color: outlineColor })
  container.addChild(g)

  // Energy fills the inner triangle bottom→top; ghodium fills the base bar.
  const { energy: nukeEnergy, energyCap: nukeECap, ghodium, ghodiumCap } = getNukerContents(obj)
  const nukerEnergyG = new Graphics()
  container.addChild(nukerEnergyG)
  const nukerGhodiumG = new Graphics()
  container.addChild(nukerGhodiumG)
  const nukerVisual = container as ContainerWithTarget
  nukerVisual.__nukerEnergyG = nukerEnergyG
  nukerVisual.__nukerGhodiumG = nukerGhodiumG
  nukerVisual.__nukerEnergy = nukeEnergy
  nukerVisual.__nukerEnergyCap = nukeECap
  nukerVisual.__nukerGhodium = ghodium
  nukerVisual.__nukerGhodiumCap = ghodiumCap
  updateNukerFill(nukerVisual, calcCenterFillFraction(nukeEnergy, nukeECap), calcCenterFillFraction(ghodium, ghodiumCap))
}
