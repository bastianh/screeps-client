import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_ENERGY } from '../colors.js'
import { lerpColor } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Source visuals: dark rock base with a pulsing golden energy core.
// Source: a fixed dark base ("rock") with a golden energy core that shrinks as the
// source is mined, revealing a dark ring. When exhausted the gold is gone (black
// center) and only the outer ring breathes to signal regeneration.
export const SRC_MAX_SIZE = TILE_SIZE - 4
// Golden core pulse: ST_ENERGY → near-white at peak, sine over SRC_PULSE_MS
export const SRC_PULSE_MS = 1600
export const SRC_PULSE_PEAK = 0xFFFCEC
// Exhausted outer ring breathes ST_DARK → SRC_DARK_PEAK (subtle dark-gray)
export const SRC_DARK_PEAK = 0x444444
export const SRC_RING_W = Math.max(1, TILE_SIZE * 0.15)

// Golden core size: 0 when empty (black center) up to the full base size at capacity.
export function calcSourceSize(energy: number, capacity: number): number {
  if (capacity <= 0) return SRC_MAX_SIZE
  const ratio = Math.max(0, Math.min(1, energy / capacity))
  return SRC_MAX_SIZE * ratio
}

// 0..1..0 triangle via cosine; shared by the golden core and the exhausted base pulse.
export function sourcePulseT(now: number): number {
  const phase = (now % SRC_PULSE_MS) / SRC_PULSE_MS
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
}

export function currentSourceColor(now: number): number {
  return lerpColor(ST_ENERGY, SRC_PULSE_PEAK, sourcePulseT(now))
}

export function drawSourceVisual(g: Graphics, goldenSize: number, now: number): void {
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  g.clear()

  const exhausted = goldenSize <= 0
  // Fixed dark base — static black center, even when exhausted.
  const baseHalf = SRC_MAX_SIZE / 2
  const baseRadius = SRC_MAX_SIZE * 0.25
  g.roundRect(cx - baseHalf, cy - baseHalf, SRC_MAX_SIZE, SRC_MAX_SIZE, baseRadius)
  g.fill(ST_DARK)

  if (exhausted) {
    // Exhausted: only the outer ring breathes (regenerating); center stays black.
    g.roundRect(cx - baseHalf, cy - baseHalf, SRC_MAX_SIZE, SRC_MAX_SIZE, baseRadius)
    g.stroke({ width: SRC_RING_W, color: lerpColor(ST_DARK, SRC_DARK_PEAK, sourcePulseT(now)) })
  } else {
    // Golden core — shrinks toward center as mined; absent (black center) when empty.
    const half = goldenSize / 2
    g.roundRect(cx - half, cy - half, goldenSize, goldenSize, goldenSize * 0.25)
    g.fill(currentSourceColor(now))
  }
}

export function updateSourceVisual(visual: ContainerWithTarget, size: number): void {
  const g = visual.__sourceGraphics
  if (!g) return
  visual.__sourceSize = size
  drawSourceVisual(g, size, performance.now())
}

export function getSourceEnergy(obj: RoomObject): { energy: number; capacity: number } {
  const energy = typeof obj.energy === 'number' ? obj.energy : 0
  const capacity = typeof obj.energyCapacity === 'number' ? obj.energyCapacity : 3000
  return { energy, capacity }
}
export function createSourceVisual(ctx: VisualBuildContext): void {
  const { obj, container } = ctx
  const { energy, capacity } = getSourceEnergy(obj)
  const size = calcSourceSize(energy, capacity)
  const srcG = new Graphics()
  drawSourceVisual(srcG, size, performance.now())
  container.addChild(srcG)
  ;(container as ContainerWithTarget).__sourceGraphics = srcG
  ;(container as ContainerWithTarget).__sourceEnergy = energy
  ;(container as ContainerWithTarget).__sourceCapacity = capacity
  ;(container as ContainerWithTarget).__sourceSize = size
}
