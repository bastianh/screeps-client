import type { RoomObject } from 'screeps-connectivity'
import { defaultSpriteTheme } from '../themes/default.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJECT_COLORS, OBJ_DEFAULT, ST_RESOURCE_OTHER, RESOURCE_COLORS } from '../colors.js'
import { type ContainerWithTarget } from './types.js'

// Shared helpers used across the per-object renderer modules and ObjectLayer itself.
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

export const EXTRACTOR_Z_INDEX = 1    // ring spins above the mineral
export const TOMBSTONE_Z_INDEX = 4    // sits above roads and containers, below creeps

// Converts screeps tile-relative coords (tile center = origin, 1 unit = TILE_SIZE px) to flat pixel array
export function spts(cx: number, cy: number, pts: ReadonlyArray<readonly [number, number]>): number[] {
  return pts.flatMap(([rx, ry]) => [cx + rx * TILE_SIZE, cy + ry * TILE_SIZE])
}

export function getObjectColor(type: string): number {
  return OBJECT_COLORS[type] ?? OBJ_DEFAULT
}

// ── Terminal / lab / nuker / factory fills ──────────────────────────────────
// These structures tint their fill by resource type (shared band palette), rather
// than showing only how full they are.
export function resourceColor(res: string): number {
  return RESOURCE_COLORS[res] ?? ST_RESOURCE_OTHER
}

export function calcCenterFillFraction(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return Math.min(1, used / capacity)
}

// Absolute tick a structure's cooldown ends (vanilla emits an absolute `cooldownTime`);
// 0 when idle. Stored on the visual so the ticker can compare it against the live clock each
// frame — `cooldownTime` is sent once and never re-sent, so a cached boolean would never clear.
export function cooldownEnd(obj: RoomObject): number {
  return typeof obj.cooldownTime === 'number' ? obj.cooldownTime : 0
}

// True while a structure is on cooldown — factory producing, extractor recharging.
export function onCooldown(obj: RoomObject): boolean {
  return typeof obj.cooldown === 'number' && obj.cooldown > 0
}

// Tier-based zIndex: structures=0, creeps=100, flags=200; each spec adds an offset
// within its tier. A spawning creep sits on its spawn's tile, so it drops below
// structures (the spawn body + progress ring then render over it) instead of popping
// on top. Other creeps stay above structures. Re-applied on update so the born
// transition (spawning → false) restores the normal creep tier.
export function computeZIndex(obj: RoomObject): number {
  const baseZ = obj.type === 'creep' ? (obj.spawning ? -1 : 100) : obj.type === 'flag' ? 200 : 0
  const specZ = obj.type === 'flag' ? (defaultSpriteTheme.flag?.zIndex ?? 0)
    : obj.type === 'controller' ? (defaultSpriteTheme.controller?.zIndex ?? 0)
    : obj.type === 'tombstone' ? TOMBSTONE_Z_INDEX
    : obj.type === 'mineral' ? (defaultSpriteTheme.mineral?.zIndex ?? 0)
    : obj.type === 'extractor' ? EXTRACTOR_Z_INDEX
    : 0
  return baseZ + specZ
}

export function destroyVisual(visual: ContainerWithTarget): void {
  visual.destroy({ children: true })
}
