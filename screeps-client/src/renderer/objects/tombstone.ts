import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJ_FOREIGN, CS_OWN } from '../colors.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Tombstone visuals: headstone outline that fades over its decay window.
// Tombstones fade out over their lifetime, as vanilla does: full alpha at deathTime,
// gone at decayTime. Both are absolute ticks, so the ticker compares them against the
// live game clock rather than caching a fraction. Neither field is declared on
// RoomObject (the server's payload is untyped) and servers may omit them entirely —
// without a sane pair the tombstone just stays fully opaque.
export function tombstoneDecay(obj: RoomObject): { death: number; decay: number } | undefined {
  const death = typeof obj.deathTime === 'number' ? obj.deathTime : undefined
  const decay = typeof obj.decayTime === 'number' ? obj.decayTime : undefined
  if (death === undefined || decay === undefined || decay <= death) return undefined
  return { death, decay }
}
export function createTombstoneVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, currentUserId } = ctx
  const tsUser = typeof obj.user === 'string' ? obj.user : undefined
  const isMine = tsUser !== undefined && tsUser === currentUserId
  const tsColor = isMine ? CS_OWN : OBJ_FOREIGN

  const w = TILE_SIZE * 0.62
  const h = TILE_SIZE * 0.82
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const r = w / 2

  // Outline only — the terrain shows through the headstone, as vanilla's does.
  const tg = new Graphics()
  tg.moveTo(x0, y0 + r)
  tg.arc(cx, y0 + r, r, Math.PI, 0, false)
  tg.lineTo(x0 + w, y0 + h)
  tg.lineTo(x0, y0 + h)
  tg.closePath()
  tg.stroke({ width: TILE_SIZE * 0.07, color: tsColor, alpha: 0.9 })
  container.addChild(tg)

  const xR = TILE_SIZE * 0.18
  const xMark = new Graphics()
  xMark.moveTo(cx - xR, cy - xR * 0.6)
  xMark.lineTo(cx + xR, cy + xR * 0.6)
  xMark.moveTo(cx + xR, cy - xR * 0.6)
  xMark.lineTo(cx - xR, cy + xR * 0.6)
  xMark.stroke({ width: TILE_SIZE * 0.09, color: tsColor, cap: 'round' })
  container.addChild(xMark)

  const tsDecay = tombstoneDecay(obj)
  if (tsDecay) {
    const tsVisual = container as ContainerWithTarget
    tsVisual.__tombstoneDeath = tsDecay.death
    tsVisual.__tombstoneDecayTime = tsDecay.decay
  }
}
