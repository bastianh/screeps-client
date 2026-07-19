import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { CS_OWN, CS_FOREIGN, CS_OWN_DARK, CS_OWN_LIGHT, CS_FOREIGN_DARK, CS_FOREIGN_LIGHT } from '../colors.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Construction-site visuals: pulsing ring with a progress pie.
// ── Construction site helpers ──────────────────────────────────────────────
// Ring sized to roughly match the small extension (outer R ≈ 0.294 * TILE),
// stroke 50% thicker than the previous CS look.
export const CS_RADIUS    = TILE_SIZE * 0.30
export const CS_STROKE    = Math.max(1, TILE_SIZE * 0.12)
export const CS_FILL_R    = CS_RADIUS - CS_STROKE / 2
export const CS_GLOW_R    = TILE_SIZE * 0.42
export const CS_PULSE_MS  = 1500  // ring pulsation period

export function drawCSRing(g: Graphics, color: number): void {
  g.clear()
  g.circle(TILE_SIZE / 2, TILE_SIZE / 2, CS_RADIUS)
  g.stroke({ width: CS_STROKE, color, alpha: 0.95 })
}

export function drawCSProgress(
  g: Graphics,
  cx: number, cy: number, r: number,
  progress: number, total: number, color: number,
): void {
  g.clear()
  if (total <= 0 || progress <= 0) return
  const ratio = Math.min(1, progress / total)
  if (ratio >= 1) {
    g.circle(cx, cy, r)
    g.fill({ color, alpha: 0.55 })
    return
  }
  const start = -Math.PI / 2  // top
  const end   = start + ratio * Math.PI * 2
  g.moveTo(cx, cy)
  g.lineTo(cx + r * Math.cos(start), cy + r * Math.sin(start))
  g.arc(cx, cy, r, start, end)
  g.closePath()
  g.fill({ color, alpha: 0.55 })
}
export function createConstructionSiteVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, currentUserId } = ctx
  const csUser = typeof obj.user === 'string' ? obj.user : undefined
  const isMine = csUser !== undefined && csUser === currentUserId
  const csColor = isMine ? CS_OWN : CS_FOREIGN
  const csDark  = isMine ? CS_OWN_DARK  : CS_FOREIGN_DARK
  const csLight = isMine ? CS_OWN_LIGHT : CS_FOREIGN_LIGHT
  const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
  const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 1

  // Build glow (under the ring, animated by tick)
  const glowG = new Graphics()
  container.addChild(glowG)
  ;(container as ContainerWithTarget).__csBuildGlow = glowG

  // Progress pie fill (static color)
  const fillG = new Graphics()
  drawCSProgress(fillG, cx, cy, CS_FILL_R, progress, progressTotal, csColor)
  container.addChild(fillG)
  ;(container as ContainerWithTarget).__csFillGraphics = fillG

  // Ring outline — color is redrawn each tick for the pulsation
  const ringG = new Graphics()
  drawCSRing(ringG, csColor)
  container.addChild(ringG)
  ;(container as ContainerWithTarget).__csRingGraphics = ringG

  ;(container as ContainerWithTarget).__csProgress      = progress
  ;(container as ContainerWithTarget).__csProgressTotal = progressTotal
  ;(container as ContainerWithTarget).__csUser          = csUser
  ;(container as ContainerWithTarget).__csColor         = csColor
  ;(container as ContainerWithTarget).__csColorDark     = csDark
  ;(container as ContainerWithTarget).__csColorLight    = csLight
}
