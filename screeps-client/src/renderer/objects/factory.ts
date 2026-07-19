import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_LIGHT } from '../colors.js'
import { cooldownEnd } from './common.js'
import { drawStoreBands, getStoreBands } from './store.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Factory visuals: cog silhouette, level ring, band fill, and the producing glow.
// Factory: a compact cog — short stubby teeth forming the gear silhouette, a level ring
// around the centre, and a storage-style band fill in the centre box. The green outline
// pulses while producing (it does not recolour the teeth themselves).
export const FACT_TEETH      = 8
export const FACT_BODY_R     = TILE_SIZE * 0.4       // body disc / tooth valley radius
export const FACT_TOOTH_OUT  = TILE_SIZE * 0.5       // tooth tips reach the tile edge
export const FACT_TOOTH_HALF = 0.22                  // radians, half angular width of a tooth
export const FACT_RING_IN    = TILE_SIZE * 0.25
export const FACT_RING_OUT   = TILE_SIZE * 0.32
export const FACT_BOX_W      = TILE_SIZE * 0.24
export const FACT_BOX_H      = TILE_SIZE * 0.28
export const FACT_BOX_X      = TILE_SIZE * 0.38      // centred: 0.5 - 0.12
export const FACT_BOX_Y      = TILE_SIZE * 0.36      // centred: 0.5 - 0.14
export const FACT_LEVELS     = 5
export const FACT_GLOW       = 0xFFFFFF              // pulse brightens the outline toward white

// One closed polygon tracing the whole cog perimeter: body-radius arcs in the valleys,
// outer-radius arcs across the tooth tips, with the radial rises/falls between them as
// the straight segments the poly draws automatically. Filled it is a solid gear.
export function factoryGearPoints(): number[] {
  const c = TILE_SIZE / 2
  const step = (2 * Math.PI) / FACT_TEETH
  const SEG = 3
  const pts: number[] = []
  for (let i = 0; i < FACT_TEETH; i++) {
    const ac = -Math.PI / 2 + i * step
    const ts = ac - FACT_TOOTH_HALF
    const te = ac + FACT_TOOTH_HALF
    const prevTe = ac - step + FACT_TOOTH_HALF
    for (let s = 0; s <= SEG; s++) {          // valley arc at body radius
      const a = prevTe + (ts - prevTe) * (s / SEG)
      pts.push(c + FACT_BODY_R * Math.cos(a), c + FACT_BODY_R * Math.sin(a))
    }
    for (let s = 0; s <= SEG; s++) {          // tooth tip arc at outer radius
      const a = ts + (te - ts) * (s / SEG)
      pts.push(c + FACT_TOOTH_OUT * Math.cos(a), c + FACT_TOOTH_OUT * Math.sin(a))
    }
  }
  return pts
}
export const FACT_GEAR_PTS = factoryGearPoints()

export function drawFactoryGear(g: Graphics, strokeColor: number): void {
  g.clear()
  g.poly(FACT_GEAR_PTS)
  g.fill(ST_DARK)
  g.poly(FACT_GEAR_PTS)
  g.stroke({ width: TILE_SIZE * 0.06, color: strokeColor })
}

export function drawFactoryRing(g: Graphics, level: number): void {
  g.clear()
  const c = TILE_SIZE / 2
  const gap = 0.14
  const seg = (2 * Math.PI / FACT_LEVELS) - gap
  for (let i = 0; i < FACT_LEVELS; i++) {
    const a0 = -Math.PI / 2 + i * (2 * Math.PI / FACT_LEVELS) + gap / 2
    const a1 = a0 + seg
    g.moveTo(c + FACT_RING_IN * Math.cos(a0), c + FACT_RING_IN * Math.sin(a0))
    g.arc(c, c, FACT_RING_OUT, a0, a1)
    g.arc(c, c, FACT_RING_IN, a1, a0, true)
    g.closePath()
    g.fill(i < level ? ST_LIGHT : ST_GRAY)
  }
}

export function calcFactoryFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return FACT_BOX_H * Math.min(1, used / capacity)
}

export function updateFactoryFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__factoryFillG
  if (!fill) return
  fill.clear()
  const margin = Math.max(0.5, TILE_SIZE * 0.03)
  drawStoreBands(fill, FACT_BOX_X, FACT_BOX_Y + FACT_BOX_H, FACT_BOX_W, height, visual.__factoryBands, visual.__factoryUsed ?? 0, margin)
}
export function createFactoryVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, outlineColor } = ctx
  const factLevel = typeof obj.level === 'number' ? obj.level : 0
  const { bands: factBands, used: factUsed, capacity: factCap } = getStoreBands(obj)

  // Gear silhouette (body + teeth in one shape); its outline pulses while producing.
  const factGearG = new Graphics()
  drawFactoryGear(factGearG, outlineColor)
  container.addChild(factGearG)

  // Centre box background, over the gear's dark fill.
  g.rect(FACT_BOX_X, FACT_BOX_Y, FACT_BOX_W, FACT_BOX_H)
  g.fill(ST_GRAY)
  container.addChild(g)

  // Level ring around the centre box.
  const factRingG = new Graphics()
  drawFactoryRing(factRingG, factLevel)
  container.addChild(factRingG)

  // Storage-style band fill inside the centre box.
  const factFillG = new Graphics()
  container.addChild(factFillG)

  const factVisual = container as ContainerWithTarget
  factVisual.__factoryGearG = factGearG
  factVisual.__factoryRingG = factRingG
  factVisual.__factoryFillG = factFillG
  factVisual.__factoryBands = factBands
  factVisual.__factoryUsed = factUsed
  factVisual.__factoryCapacity = factCap
  factVisual.__factoryLevel = factLevel
  factVisual.__factoryCooldownEnd = cooldownEnd(obj)
  factVisual.__factoryGlowColor = outlineColor
  updateFactoryFill(factVisual, calcFactoryFillHeight(factUsed, factCap))
}
