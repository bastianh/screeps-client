import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_ENERGY } from '../colors.js'
import { calcCenterFillFraction, cooldownEnd, resourceColor } from './common.js'
import { getStoreBands } from './store.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Terminal visuals: octagon, arrows, plate, resource fill, and the send-cooldown pulse.
// ── Terminal ───────────────────────────────────────────────────────────────
// Geometry follows the official client's terminal art (terminal-border.svg,
// terminal.svg, terminal-arrows.svg, terminal-highlight.svg): an owner-outlined
// octagon over four arrows around a dark plate with a grey face. Those are authored
// in a 200 viewBox rendered at 200px on a 100px tile, so one unit is 0.01 tiles and
// upstream's terminal spans 1.7 tiles. Scaled to just over a tile, as storage is.
export const TERMINAL_SCALE = 0.75
export const TERMINAL_U = TILE_SIZE * 0.01 * TERMINAL_SCALE

// Converts terminal reference-art coords (tile centre = origin, 1 unit = TERMINAL_U px)
export function tpts(cx: number, cy: number, pts: ReadonlyArray<readonly [number, number]>): number[] {
  return pts.flatMap(([rx, ry]) => [cx + rx * TERMINAL_U, cy + ry * TERMINAL_U])
}

// Octagon: corners at ±85 on the axes, ±55 diagonally.
export const TERMINAL_OCTAGON: ReadonlyArray<readonly [number, number]> = [
  [85, 0], [55, -55], [0, -85], [-55, -55], [-85, 0], [-55, 55], [0, 85], [55, 55],
]
export const TERMINAL_STROKE = 7 * TERMINAL_U
export const TERMINAL_PLATE = 90 * TERMINAL_U  // dark plate; the grey face insets 7 inside it
export const TERMINAL_FACE = 76 * TERMINAL_U

// Four arrows pointing out from behind the plate: tips at ±67, bases at ±48 (just
// clear of the plate's ±45 edge) and 70 wide.
export const TERMINAL_ARROWS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, -67], [-35, -48], [35, -48]],  // up
  [[67, 0], [48, -35], [48, 35]],     // right
  [[0, 67], [35, 48], [-35, 48]],     // down
  [[-67, 0], [-48, 35], [-48, -35]],  // left
]
export const TERMINAL_ARROW_COLOR = 0xCCCCCC
export const TERMINAL_ARROW_CD_ALPHA = 0.1  // arrows dim while on send cooldown

// Terminal: a square that grows from the plate centre, tinted by the dominant resource.
// Upstream sizes its (nested, per-resource) squares off the same 76 face.
export const TERMINAL_FILL_HALF = TERMINAL_FACE / 2
export function updateTerminalFill(visual: ContainerWithTarget, fraction: number): void {
  const fill = visual.__terminalFillG
  if (!fill) return
  fill.clear()
  if (fraction > 0) {
    const c = TILE_SIZE / 2
    const half = TERMINAL_FILL_HALF * fraction
    fill.rect(c - half, c - half, half * 2, half * 2)
    fill.fill(visual.__terminalFillColor ?? ST_ENERGY)
  }
}

// Terminal cooldown pulse: vanilla breathes a white highlight over the ring between the
// octagon and the plate — the band the arrows sit in — once per tick while on send
// cooldown, and dims the arrows underneath it. The plate is cut out so the grey face and
// the resource fill don't flash with it. Drawn once at peak and alpha-pulsed by the ticker
// (0 → peak → 0), matching the lab idiom.
export const TERMINAL_GLOW_COLOR = 0xFFFFFF
export const TERMINAL_GLOW_ALPHA = 0.55   // peak; the ticker scales it by the per-tick pulse
export function drawTerminalCooldownGlow(g: Graphics, cx: number, cy: number): void {
  g.poly(tpts(cx, cy, TERMINAL_OCTAGON))
  g.fill({ color: TERMINAL_GLOW_COLOR, alpha: TERMINAL_GLOW_ALPHA })
  g.rect(cx - TERMINAL_PLATE / 2, cy - TERMINAL_PLATE / 2, TERMINAL_PLATE, TERMINAL_PLATE)
  g.cut()
}
export function createTerminalVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, outlineColor } = ctx
  const termOctagon = tpts(cx, cy, TERMINAL_OCTAGON)
  g.poly(termOctagon)
  g.fill(ST_DARK)
  g.poly(termOctagon)
  g.stroke({ width: TERMINAL_STROKE, color: outlineColor })
  container.addChild(g)

  // Arrows sit between the octagon and the plate, and dim on send cooldown — so they
  // need their own Graphics for the ticker to alpha (see __terminalArrowsG).
  const termArrowsG = new Graphics()
  for (const arrow of TERMINAL_ARROWS) {
    termArrowsG.poly(tpts(cx, cy, arrow))
    termArrowsG.fill(TERMINAL_ARROW_COLOR)
  }
  container.addChild(termArrowsG)

  const termPlateG = new Graphics()
  termPlateG.rect(cx - TERMINAL_PLATE / 2, cy - TERMINAL_PLATE / 2, TERMINAL_PLATE, TERMINAL_PLATE)
  termPlateG.fill(ST_DARK)
  termPlateG.rect(cx - TERMINAL_FACE / 2, cy - TERMINAL_FACE / 2, TERMINAL_FACE, TERMINAL_FACE)
  termPlateG.fill(ST_GRAY)
  container.addChild(termPlateG)

  // Store fill: a square that grows from the centre, tinted by the dominant resource,
  // animated each tick via the shared fill-tween loop (see startTerminalFillAnimation).
  const { used: termUsed, capacity: termCap, dominant: termDominant } = getStoreBands(obj)
  const termFillG = new Graphics()
  container.addChild(termFillG)
  const termVisual = container as ContainerWithTarget
  termVisual.__terminalFillG = termFillG
  termVisual.__terminalDominant = termDominant ?? undefined
  termVisual.__terminalFillColor = termDominant ? resourceColor(termDominant) : ST_ENERGY
  termVisual.__terminalUsed = termUsed
  termVisual.__terminalCapacity = termCap
  updateTerminalFill(termVisual, calcCenterFillFraction(termUsed, termCap))

  // Cooldown pulse: a white highlight over the arrow ring, alpha-pulsed by the ticker
  // while on send cooldown, with the arrows dimmed under it. cooldownTime is absolute,
  // so store it and compare against the live game clock each frame (see cooldownEnd)
  // instead of caching a boolean.
  const termCooldownG = new Graphics()
  drawTerminalCooldownGlow(termCooldownG, cx, cy)
  termCooldownG.alpha = 0
  container.addChild(termCooldownG)
  termVisual.__terminalArrowsG = termArrowsG
  termVisual.__terminalCooldownG = termCooldownG
  termVisual.__terminalCooldownTime = cooldownEnd(obj)
}
