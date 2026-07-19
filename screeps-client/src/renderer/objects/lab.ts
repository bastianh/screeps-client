import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_ENERGY, ST_RESOURCE_OTHER } from '../colors.js'
import { calcCenterFillFraction, cooldownEnd, resourceColor, spts } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Lab visuals: bowl with mineral disc + energy bar, and the reaction-cooldown pulse.
// Lab: energy fills the base bar (left→right); the single stored mineral fills the bowl
// as a disc from the centre, drawn behind the bar and tinted by mineral type.
export const LAB_BOWL_DY     = TILE_SIZE * 0.025
export const LAB_FILL_MAX_R  = TILE_SIZE * 0.36
export const LAB_BAR_X       = TILE_SIZE * 0.05
export const LAB_BAR_Y       = TILE_SIZE * 0.8
export const LAB_BAR_W       = TILE_SIZE * 0.9
export const LAB_BAR_H       = TILE_SIZE * 0.25
export const LAB_ENERGY_CAP  = 2000   // fallback when the server omits per-resource caps
export const LAB_MINERAL_CAP = 3000

// Lab cooldown pulse: a soft white glow on the bowl's RIM (not a centre fill, which would
// wash the mineral disc) that breathes while the lab is on reaction cooldown, matching
// vanilla's pulsing lab highlight. Drawn once at peak opacity as a wide faint halo stroke
// under a brighter core stroke, both on the bowl-rim radius; the ticker scales its alpha by
// the per-tick pulse (0 → peak → 0).
export const LAB_GLOW_COLOR  = 0xFFFFFF
export const LAB_GLOW_RING_R = TILE_SIZE * 0.55   // bowl rim radius (matches the bowl's outer stroke)
export const LAB_GLOW_HALO_W = TILE_SIZE * 0.16   // wide, faint outer halo
export const LAB_GLOW_CORE_W = TILE_SIZE * 0.07   // brighter rim core
export const LAB_GLOW_HALO_A = 0.22
export const LAB_GLOW_CORE_A = 0.5
export function drawLabCooldownGlow(g: Graphics, cx: number, cy: number): void {
  g.circle(cx, cy, LAB_GLOW_RING_R)
  g.stroke({ width: LAB_GLOW_HALO_W, color: LAB_GLOW_COLOR, alpha: LAB_GLOW_HALO_A })
  g.circle(cx, cy, LAB_GLOW_RING_R)
  g.stroke({ width: LAB_GLOW_CORE_W, color: LAB_GLOW_COLOR, alpha: LAB_GLOW_CORE_A })
}

export function getLabContents(obj: RoomObject): {
  energy: number; energyCap: number; mineralType: string | null; mineral: number; mineralCap: number
} {
  const store = (obj.store && typeof obj.store === 'object') ? obj.store as Record<string, number> : {}
  const caps = (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object')
    ? obj.storeCapacityResource as Record<string, number> : {}
  const energy = typeof store.energy === 'number' ? store.energy : 0
  const energyCap = typeof caps.energy === 'number' ? caps.energy : LAB_ENERGY_CAP
  let mineralType: string | null = null
  let mineral = 0
  for (const k in store) {
    if (k === 'energy') continue
    const v = store[k]
    if (typeof v === 'number' && v > mineral) { mineral = v; mineralType = k }
  }
  const mineralCap = (mineralType && typeof caps[mineralType] === 'number') ? caps[mineralType]! : LAB_MINERAL_CAP
  return { energy, energyCap, mineralType, mineral, mineralCap }
}

export function updateLabFill(visual: ContainerWithTarget, energyFraction: number, mineralFraction: number): void {
  const disc = visual.__labMineralG
  if (disc) {
    disc.clear()
    if (mineralFraction > 0) {
      const c = TILE_SIZE / 2
      disc.circle(c, c - LAB_BOWL_DY, LAB_FILL_MAX_R * mineralFraction)
      disc.fill(visual.__labMineralColor ?? ST_RESOURCE_OTHER)
    }
  }
  const bar = visual.__labEnergyG
  if (bar) {
    bar.clear()
    if (energyFraction > 0) {
      const m = Math.max(0.5, TILE_SIZE * 0.04)
      bar.rect(LAB_BAR_X + m, LAB_BAR_Y + m, (LAB_BAR_W - m * 2) * energyFraction, LAB_BAR_H - m * 2)
      bar.fill(ST_ENERGY)
    }
  }
}
export function createLabVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, outlineColor } = ctx
  const labCy = cy - TILE_SIZE * 0.025
  // Bowl: ring + inner basin (on the shared graphics g, at the back).
  g.circle(cx, labCy, TILE_SIZE * 0.55)
  g.fill(ST_DARK)
  g.circle(cx, labCy, TILE_SIZE * 0.55)
  g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  g.circle(cx, labCy, TILE_SIZE * 0.4)
  g.fill(ST_GRAY)
  container.addChild(g)

  const { energy: labEnergy, energyCap, mineralType, mineral, mineralCap } = getLabContents(obj)

  // Mineral fill: a disc growing from the bowl centre, drawn behind the base bar.
  const labMineralG = new Graphics()
  container.addChild(labMineralG)

  // Base bar: dark background + outline, over the disc so it caps the bowl.
  const labBarG = new Graphics()
  labBarG.rect(cx - TILE_SIZE * 0.45, cy + TILE_SIZE * 0.3, TILE_SIZE * 0.9, TILE_SIZE * 0.25)
  labBarG.fill(ST_DARK)
  labBarG.poly(spts(cx, cy, [[-0.45, 0.3], [-0.45, 0.55], [0.45, 0.55], [0.45, 0.3]]))
  labBarG.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  container.addChild(labBarG)

  // Energy fill: fills the base bar left→right.
  const labEnergyG = new Graphics()
  container.addChild(labEnergyG)

  const labVisual = container as ContainerWithTarget
  labVisual.__labMineralG = labMineralG
  labVisual.__labEnergyG = labEnergyG
  labVisual.__labMineralType = mineralType ?? undefined
  labVisual.__labMineralColor = mineralType ? resourceColor(mineralType) : undefined
  labVisual.__labEnergy = labEnergy
  labVisual.__labEnergyCap = energyCap
  labVisual.__labMineral = mineral
  labVisual.__labMineralCap = mineralCap
  updateLabFill(labVisual, calcCenterFillFraction(labEnergy, energyCap), calcCenterFillFraction(mineral, mineralCap))

  // Cooldown pulse: a white halo over the bowl, alpha-pulsed by the ticker while the lab
  // is on reaction cooldown. cooldownTime is absolute, so store it and compare against the
  // live game clock each frame (see cooldownEnd) instead of caching a boolean.
  const labCooldownG = new Graphics()
  drawLabCooldownGlow(labCooldownG, cx, labCy)
  labCooldownG.alpha = 0
  container.addChild(labCooldownG)
  labVisual.__labCooldownG = labCooldownG
  labVisual.__labCooldownTime = cooldownEnd(obj)
}
