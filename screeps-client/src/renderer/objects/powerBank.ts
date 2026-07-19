import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { lerpColor } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Power-bank visuals: octagonal shell with a pulsing red power ellipse.
// ── Power bank helpers ─────────────────────────────────────────────────────
// Dark octagonal shell with a red power ellipse that scales with stored power.
// Color pulses through #f41f33 → #d31022 → #8d000d → #f41f33 over 2s.
// Ellipse scales 1→0.6→1 over the same period.
// Geometry is derived from the original SVG: viewBox 300×300, g scale(1.5), so
// 1 tile = 100 SVG units after scale; the octagon's outer half-extent is 75 units.
export const POWER_BANK_CAPACITY_MAX = 5000
export const PB_S = TILE_SIZE / 100                         // svg-unit → tile-pixel
export const PB_STROKE_W = Math.max(1, TILE_SIZE * 0.1)
export const PB_SHELL_FILL = 0x331111
export const PB_SHELL_STROKE = 0x666666
export const PB_ANIM_MS = 2000
export const PB_COLOR_0 = 0xf41f33
export const PB_COLOR_1 = 0xd31022
export const PB_COLOR_2 = 0x8d000d

// Octagon vertices derived from SVG path M0 -50 H30 L50 -30 V30 L30 50 H-30 L-50 30 V-30 L-30 -50 Z
// scaled by 1.5. These are the tile-relative offsets (multiply by PB_S).
export const PB_OCTO_OFFSETS = [
  -45, -75,  45, -75,  75, -45,  75, 45,  45, 75,  -45, 75,  -75, 45,  -75, -45,
]

export function getPowerBankPower(obj: RoomObject): number {
  // Old-format servers send power as a direct field; new-format sends it via store.
  if (typeof obj.power === 'number') return obj.power
  const store = (obj.store && typeof obj.store === 'object') ? obj.store as Record<string, number> : {}
  return typeof store.power === 'number' ? store.power : 0
}

export function calcPowerBankRadius(power: number): number {
  // svgR is in pre-scale coords; the g transform scale(1.5) applies before tile conversion
  const svgR = Math.sqrt(Math.max(0, power) / POWER_BANK_CAPACITY_MAX * 3000 / Math.PI)
  return svgR * 1.5 * PB_S
}

export function powerBankFillColor(now: number): number {
  const t = (now % PB_ANIM_MS) / PB_ANIM_MS
  if (t < 1 / 3) return lerpColor(PB_COLOR_0, PB_COLOR_1, t * 3)
  if (t < 2 / 3) return lerpColor(PB_COLOR_1, PB_COLOR_2, (t - 1 / 3) * 3)
  return lerpColor(PB_COLOR_2, PB_COLOR_0, (t - 2 / 3) * 3)
}

export function drawPowerBankEllipse(g: Graphics, radius: number, now: number): void {
  g.clear()
  if (radius <= 0) return
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const pulse = 0.8 + 0.2 * Math.cos((now % PB_ANIM_MS) / PB_ANIM_MS * 2 * Math.PI)
  const r = radius * pulse
  g.circle(cx, cy, r)
  g.fill(powerBankFillColor(now))
  g.circle(cx, cy, r)
  g.stroke({ width: PB_STROKE_W, color: PB_COLOR_2 })
}
export function createPowerBankVisual(ctx: VisualBuildContext): void {
  const { obj, container } = ctx
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  // Octagonal shell
  const octoG = new Graphics()
  const octoPts: number[] = []
  for (let i = 0; i < PB_OCTO_OFFSETS.length; i += 2) {
    octoPts.push(cx + PB_OCTO_OFFSETS[i]! * PB_S, cy + PB_OCTO_OFFSETS[i + 1]! * PB_S)
  }
  octoG.poly(octoPts)
  octoG.fill(PB_SHELL_FILL)
  octoG.poly(octoPts)
  octoG.stroke({ width: PB_STROKE_W, color: PB_SHELL_STROKE })
  container.addChild(octoG)
  // Animated power ellipse
  const power = getPowerBankPower(obj)
  const pbRadius = calcPowerBankRadius(power)
  const ellipseG = new Graphics()
  drawPowerBankEllipse(ellipseG, pbRadius, performance.now())
  container.addChild(ellipseG)
  const cwt = container as ContainerWithTarget
  cwt.__powerBankEllipseG = ellipseG
  cwt.__powerBankPower = power
  cwt.__powerBankRadius = pbRadius
}
