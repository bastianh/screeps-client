import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJ_GREY } from '../colors.js'
import { onCooldown } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Mineral-extractor visuals: three gapped arc segments that spin while on cooldown.
// Mineral-extractor ring: three stroked arc segments with gaps, centered at (0,0)
// so the Graphics rotates about its own center (spun by the ticker). Radius/width
// match the previous ~2.6-tile atlas footprint.
export const EXTRACTOR_RING_R = TILE_SIZE * 0.975  // 0.75 × the original ~2.6-tile footprint
export const EXTRACTOR_RING_W = Math.max(1, TILE_SIZE * 0.18)
export const EXTRACTOR_GAP    = Math.PI / 3  // rad gap; equals the segment arc (3 segments + 3 gaps = 2π)

export function drawExtractorRing(g: Graphics, color: number): void {
  g.clear()
  for (let i = 0; i < 3; i++) {
    const a0 = i * (2 * Math.PI / 3) + EXTRACTOR_GAP / 2
    const a1 = a0 + (2 * Math.PI / 3) - EXTRACTOR_GAP
    g.arc(0, 0, EXTRACTOR_RING_R, a0, a1)
    g.stroke({ width: EXTRACTOR_RING_W, color, cap: 'round' })
  }
}

export const EXTRACTOR_RING_SPEED = Math.PI / 2  // rad/s — one full turn every 4s (matches vanilla)
export function createExtractorVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, outlineColor, ownedByUser } = ctx
  // Ring rendered above the mineral — three gapped arc segments drawn procedurally
  // (one extractor per room, so no atlas needed). It rotates only while the extractor
  // is on cooldown (the ticks after a harvest), matching vanilla. Tinted tri-state by
  // room ownership: owner green when ours, hostile red when foreign-owned, neutral
  // grey when the room is unowned (extractor has no owner).
  const ring = new Graphics()
  ring.position.set(cx, cy)
  drawExtractorRing(ring, ownedByUser === undefined ? OBJ_GREY : outlineColor)
  container.addChild(ring)
  const extVisual = container as ContainerWithTarget
  extVisual.__extractorRing = ring
  extVisual.__extractorActive = onCooldown(obj)
}
