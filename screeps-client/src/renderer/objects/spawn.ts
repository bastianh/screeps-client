import { Graphics, Sprite } from 'pixi.js'
import type { RoomObject, Badge } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_ENERGY } from '../colors.js'
import { calcCenterFillFraction } from './common.js'
import { getExtensionEnergy, updateExtensionFill } from './extension.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Spawn visuals: badge disc, energy core, and the creep-spawning progress ring.
// ── Spawn progress ring ─────────────────────────────────────────────────────
// Ring in the dark moat between the energy core (R≈0.4) and the outer gray ring
// (inner edge≈0.6); fills clockwise from the top as a creep spawns. Driven by
// obj.spawning (needTime + remainingTime, falling back to spawnTime vs. game time).
export const SPAWN_RING_R = TILE_SIZE * 0.5
export const SPAWN_RING_W = Math.max(1, TILE_SIZE * 0.1)
// Energy core radius — the inner yellow disc scales its radius with stored energy.
export const SPAWN_INNER_R = TILE_SIZE * 0.4

// Resolve a spawn's progress to an absolute completion tick + duration, so the
// ring can be driven by the local game clock between server updates (the server
// does NOT reliably re-send remainingTime every tick — relying on it freezes).
export function spawnTiming(obj: RoomObject, gameTime: number): { needTime: number; endTime: number } | null {
  const s = obj.spawning as { needTime?: unknown; remainingTime?: unknown; spawnTime?: unknown } | null | undefined
  if (!s || typeof s !== 'object') return null
  const needTime = typeof s.needTime === 'number' && s.needTime > 0 ? s.needTime : null
  if (needTime === null) return null
  if (typeof s.remainingTime === 'number') return { needTime, endTime: gameTime + s.remainingTime }
  // spawnTime in the future is the completion tick; in the past it's the start tick.
  if (typeof s.spawnTime === 'number') return { needTime, endTime: s.spawnTime > gameTime ? s.spawnTime : s.spawnTime + needTime }
  return { needTime, endTime: gameTime + needTime }  // active but no timing — assume just started
}

// Signature of the spawning payload — when it changes we re-sync endTime; otherwise
// the ring advances purely from the local clock so it never stalls.
export function spawnSig(obj: RoomObject): string | null {
  const s = obj.spawning as { name?: unknown; needTime?: unknown; remainingTime?: unknown; spawnTime?: unknown } | null | undefined
  if (!s || typeof s !== 'object') return null
  return `${String(s.name)}:${String(s.needTime)}:${String(s.remainingTime)}:${String(s.spawnTime)}`
}

export function spawnRatio(needTime: number, endTime: number, gameTime: number): number {
  return Math.max(0, Math.min(1, 1 - (endTime - gameTime) / needTime))
}

export function drawSpawnRing(g: Graphics, ratio: number | null): void {
  g.clear()
  if (ratio === null) return
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  // Faint full-circle track so an active spawn reads even at 0% progress
  g.circle(cx, cy, SPAWN_RING_R)
  g.stroke({ width: SPAWN_RING_W, color: 0xffffff, alpha: 0.12 })
  if (ratio <= 0) return
  const start = -Math.PI / 2  // top
  const end = start + Math.min(1, ratio) * Math.PI * 2
  g.moveTo(cx + SPAWN_RING_R * Math.cos(start), cy + SPAWN_RING_R * Math.sin(start))
  g.arc(cx, cy, SPAWN_RING_R, start, end)
  g.stroke({ width: SPAWN_RING_W, color: ST_ENERGY, alpha: 0.95, cap: 'round' })
}

// Spawn energy core: a yellow disc whose radius tracks the stored-energy fraction
// (percentage full). Painted via updateExtensionFill — same center-circle fill.
export function calcSpawnFillRadius(energy: number, capacity: number): number {
  return SPAWN_INNER_R * calcCenterFillFraction(energy, capacity)
}
export function createSpawnVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, badgeCache, users } = ctx
  // Layered by zIndex (sorted below; body `g` is added after the switch at 0):
  // dark backdrop `g` (0) → owner badge (1) → energy core (2) → rim outline (3)
  // → progress ring (4). The backdrop only shows through until the badge texture
  // resolves, or stays for NPC/unowned spawns.
  const R = TILE_SIZE * 0.65
  g.circle(cx, cy, R)
  g.fill(ST_DARK)
  container.sortableChildren = true
  const cwt = container as ContainerWithTarget

  // Owner's badge fills the body disc — the structure background (was flat black).
  const spawnUserId = typeof obj.user === 'string' ? obj.user : undefined
  const spawnBadge = spawnUserId ? users?.[spawnUserId]?.badge : undefined
  if (spawnBadge && badgeCache) {
    const bs = new Sprite()
    bs.anchor.set(0.5, 0.5)
    bs.width = R * 2
    bs.height = R * 2
    bs.position.set(cx, cy)
    bs.zIndex = 1
    const bsMask = new Graphics()
    bsMask.circle(cx, cy, R)
    bsMask.fill(0xffffff)
    bs.mask = bsMask
    container.addChild(bs)
    container.addChild(bsMask)
    cwt.__spawnBadgeSprite = bs
    badgeCache.getOrCreate(spawnBadge as Badge).then((tex) => { if (!bs.destroyed) bs.texture = tex }).catch(() => {})
  }

  // Inner yellow disc, scaled to reflect stored energy (percentage full).
  const { energy, capacity } = getExtensionEnergy(obj)
  const fill = new Graphics()
  fill.zIndex = 2
  container.addChild(fill)
  cwt.__fillGraphics = fill
  updateExtensionFill(cwt, calcSpawnFillRadius(energy, capacity))
  cwt.__spawnEnergy = energy
  cwt.__spawnCapacity = capacity

  // Moat rim outline — above the badge so the edge stays crisp.
  const rim = new Graphics()
  rim.circle(cx, cy, R)
  rim.stroke({ width: TILE_SIZE * 0.1, color: 0xcccccc })
  rim.zIndex = 3
  container.addChild(rim)

  const spawnRing = new Graphics()
  spawnRing.zIndex = 4
  const t = spawnTiming(obj, 0)
  const ratio = t ? spawnRatio(t.needTime, t.endTime, 0) : null
  drawSpawnRing(spawnRing, ratio)
  container.addChild(spawnRing)
  cwt.__spawnRing = spawnRing
  cwt.__spawnRatio = ratio
  if (t) { cwt.__spawnNeedTime = t.needTime; cwt.__spawnEndTime = t.endTime }
  cwt.__spawnSig = spawnSig(obj)
}
