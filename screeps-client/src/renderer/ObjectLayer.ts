import { Container, Graphics, Text, Ticker, Sprite, Texture, BlurFilter } from 'pixi.js'
import type { RoomObject, RoomObjectMap, RoomObjectDiff, Badge } from 'screeps-connectivity'
import { BadgeTextureCache } from './BadgeTextureCache.js'
import type { Theme, ControllerSpec, FlagSpec, TombstoneSpec } from './themes/Theme.js'
import type { AtlasCache } from './AtlasCache.js'
import type { LightingLayer } from './LightingLayer.js'

const sharedBadgeCache = new BadgeTextureCache()
import { TILE_SIZE } from './RoomRenderer.js'
import { CONTROLLER_DOWNGRADE } from '~/utils/gameConstants.js'
import {
  BODY_PART_COLORS,
  OBJECT_COLORS,
  BG_DEEP, BG_DARK,
  OBJ_DEFAULT, OBJ_ROAD, OBJ_FOREIGN, OBJ_CYAN, OBJ_GREY,
  ENERGY_FILL,
  CREEP_RING_DARK, CREEP_NOTCH,
  ST_DARK, ST_GRAY, ST_LIGHT, ST_OUTLINE, ST_ENERGY, ST_POWER, ST_RAMPART,
  ST_RAMPART_STROKE, ST_RAMPART_ENEMY, ST_RAMPART_ENEMY_STROKE,
  ST_RESOURCE_OTHER, RESOURCE_COLORS,
  TERRAIN_WALL_BORDER,
  FLAG_COLORS,
  CS_OWN, CS_FOREIGN, CS_OWN_DARK, CS_OWN_LIGHT, CS_FOREIGN_DARK, CS_FOREIGN_LIGHT,
} from './colors.js'

const CREEP_OUTER_R = TILE_SIZE * 0.44
const CREEP_INNER_R = TILE_SIZE * 0.28
const CREEP_MAX_BODY = 50

const LABEL_FONT_SIZE  = 32
const LABEL_FONT_SCALE = 12 / LABEL_FONT_SIZE  // base scale: ~12px height at world-scale=1
// Label bottom sits GAP_PX screen-pixels above the creep outer edge; constant across zoom levels.
const LABEL_CREEP_TOP = TILE_SIZE / 2 - TILE_SIZE * 0.44  // CREEP_OUTER_R in container space
const LABEL_GAP_PX    = 2

// Speech bubble (creep.say) — designed in "world units" with SAY_FONT_SCALE baked into the
// text scale. The whole bubble container then gets (1 / worldScale) applied so its on-screen
// size stays constant across zoom levels (same trick as __nameLabel).
const SAY_FONT_SCALE = (12 * 1.2) / LABEL_FONT_SIZE  // ~14.4px tall at world-scale=1 (20% bigger than name labels)
const SAY_PAD_X      = 5
const SAY_PAD_Y      = 2.5
const SAY_TAIL_W     = 2.0
const SAY_TAIL_H     = 2.6
const SAY_GAP_PX     = 2     // screen-pixel gap between creep edge and tail tip
const SAY_MAX_CHARS  = 12    // server already caps say() at 10 chars; defensive trim
const SAY_BG_COLOR   = 0xf0f0f0
const SAY_TX_COLOR   = 0x1a1a1a

const EXT_OUTER_R = TILE_SIZE * 0.42
const EXT_INNER_R = TILE_SIZE * 0.30
const EXT_STROKE_W = Math.max(1, TILE_SIZE * 0.08)

// ── Mineral helpers ────────────────────────────────────────────────────────
// Mineral disc fill colours come from the shared RESOURCE_COLORS palette (colors.ts),
// so a mineral reads the same as a deposit disc and as a structure store-fill band.
// Letter color: dark for very light discs (H, O), white otherwise.
const MINERAL_TEXT_COLORS: Record<string, number> = {
  H: 0x222222,
  O: 0x222222,
}
// Deposit commodity colors — from the official client's market-resource SVGs.
const DEPOSIT_COLORS: Record<string, number> = {
  biomass: 0x84b012,  // green
  metal:   0x956f5c,  // copper/brown
  mist:    0xda6bf5,  // violet
  silicon: 0x4ca7e5,  // blue
}
// Fill layer is kept mostly transparent so the rock shape reads through it.
const DEPOSIT_FILL_ALPHA = 0.2
const MINERAL_R = TILE_SIZE * 0.42
const MINERAL_GLYPH_FONT = 32
const MINERAL_GLYPH_SCALE = 9 / MINERAL_GLYPH_FONT  // glyph ~9px tall in tile space

// Source: a fixed dark base ("rock") with a golden energy core that shrinks as the
// source is mined, revealing a dark ring. When exhausted the gold is gone (black
// center) and only the outer ring breathes to signal regeneration.
const SRC_MAX_SIZE = TILE_SIZE - 4
// Golden core pulse: ST_ENERGY → near-white at peak, sine over SRC_PULSE_MS
const SRC_PULSE_MS = 1600
const SRC_PULSE_PEAK = 0xFFFCEC
// Exhausted outer ring breathes ST_DARK → SRC_DARK_PEAK (subtle dark-gray)
const SRC_DARK_PEAK = 0x444444
const SRC_RING_W = Math.max(1, TILE_SIZE * 0.15)

// Golden core size: 0 when empty (black center) up to the full base size at capacity.
function calcSourceSize(energy: number, capacity: number): number {
  if (capacity <= 0) return SRC_MAX_SIZE
  const ratio = Math.max(0, Math.min(1, energy / capacity))
  return SRC_MAX_SIZE * ratio
}

// 0..1..0 triangle via cosine; shared by the golden core and the exhausted base pulse.
function sourcePulseT(now: number): number {
  const phase = (now % SRC_PULSE_MS) / SRC_PULSE_MS
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
}

function currentSourceColor(now: number): number {
  return lerpColor(ST_ENERGY, SRC_PULSE_PEAK, sourcePulseT(now))
}

function drawSourceVisual(g: Graphics, goldenSize: number, now: number): void {
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

function updateSourceVisual(visual: ContainerWithTarget, size: number): void {
  const g = visual.__sourceGraphics
  if (!g) return
  visual.__sourceSize = size
  drawSourceVisual(g, size, performance.now())
}

function getSourceEnergy(obj: RoomObject): { energy: number; capacity: number } {
  const energy = typeof obj.energy === 'number' ? obj.energy : 0
  const capacity = typeof obj.energyCapacity === 'number' ? obj.energyCapacity : 3000
  return { energy, capacity }
}

// ── Construction site helpers ──────────────────────────────────────────────
// Ring sized to roughly match the small extension (outer R ≈ 0.294 * TILE),
// stroke 50% thicker than the previous CS look.
const CS_RADIUS    = TILE_SIZE * 0.30
const CS_STROKE    = Math.max(1, TILE_SIZE * 0.12)
const CS_FILL_R    = CS_RADIUS - CS_STROKE / 2
const CS_GLOW_R    = TILE_SIZE * 0.42
const CS_PULSE_MS  = 1500  // ring pulsation period

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

function drawCSRing(g: Graphics, color: number): void {
  g.clear()
  g.circle(TILE_SIZE / 2, TILE_SIZE / 2, CS_RADIUS)
  g.stroke({ width: CS_STROKE, color, alpha: 0.95 })
}

// Mineral-extractor ring: three stroked arc segments with gaps, centered at (0,0)
// so the Graphics rotates about its own center (spun by the ticker). Radius/width
// match the previous ~2.6-tile atlas footprint.
const EXTRACTOR_RING_R = TILE_SIZE * 0.975  // 0.75 × the original ~2.6-tile footprint
const EXTRACTOR_RING_W = Math.max(1, TILE_SIZE * 0.18)
const EXTRACTOR_GAP    = Math.PI / 3  // rad gap; equals the segment arc (3 segments + 3 gaps = 2π)
const EXTRACTOR_Z_INDEX = 1    // ring spins above the mineral

function drawExtractorRing(g: Graphics, color: number): void {
  g.clear()
  for (let i = 0; i < 3; i++) {
    const a0 = i * (2 * Math.PI / 3) + EXTRACTOR_GAP / 2
    const a1 = a0 + (2 * Math.PI / 3) - EXTRACTOR_GAP
    g.arc(0, 0, EXTRACTOR_RING_R, a0, a1)
    g.stroke({ width: EXTRACTOR_RING_W, color, cap: 'round' })
  }
}

function drawCSProgress(
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

// ── Spawn progress ring ─────────────────────────────────────────────────────
// Ring in the dark moat between the energy core (R≈0.4) and the outer gray ring
// (inner edge≈0.6); fills clockwise from the top as a creep spawns. Driven by
// obj.spawning (needTime + remainingTime, falling back to spawnTime vs. game time).
const SPAWN_RING_R = TILE_SIZE * 0.5
const SPAWN_RING_W = Math.max(1, TILE_SIZE * 0.1)

// Resolve a spawn's progress to an absolute completion tick + duration, so the
// ring can be driven by the local game clock between server updates (the server
// does NOT reliably re-send remainingTime every tick — relying on it freezes).
function spawnTiming(obj: RoomObject, gameTime: number): { needTime: number; endTime: number } | null {
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
function spawnSig(obj: RoomObject): string | null {
  const s = obj.spawning as { name?: unknown; needTime?: unknown; remainingTime?: unknown; spawnTime?: unknown } | null | undefined
  if (!s || typeof s !== 'object') return null
  return `${String(s.name)}:${String(s.needTime)}:${String(s.remainingTime)}:${String(s.spawnTime)}`
}

function spawnRatio(needTime: number, endTime: number, gameTime: number): number {
  return Math.max(0, Math.min(1, 1 - (endTime - gameTime) / needTime))
}

function drawSpawnRing(g: Graphics, ratio: number | null): void {
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

// Converts screeps tile-relative coords (tile center = origin, 1 unit = TILE_SIZE px) to flat pixel array
function spts(cx: number, cy: number, pts: ReadonlyArray<readonly [number, number]>): number[] {
  return pts.flatMap(([rx, ry]) => [cx + rx * TILE_SIZE, cy + ry * TILE_SIZE])
}

function drawCreepArc(g: Graphics, startAngle: number, endAngle: number, color: number): void {
  if (endAngle - startAngle < 0.001) return
  g.moveTo(CREEP_OUTER_R * Math.cos(startAngle), CREEP_OUTER_R * Math.sin(startAngle))
  g.arc(0, 0, CREEP_OUTER_R, startAngle, endAngle)
  g.lineTo(CREEP_INNER_R * Math.cos(endAngle), CREEP_INNER_R * Math.sin(endAngle))
  g.arc(0, 0, CREEP_INNER_R, endAngle, startAngle, true)
  g.closePath()
  g.fill(color)
}

function getCreepStore(obj: RoomObject): { used: number; capacity: number } {
  let capacity = 0
  if (typeof obj.storeCapacity === 'number') {
    capacity = obj.storeCapacity
  } else {
    const body = obj.body as Array<{ type: string }> | undefined
    if (body) capacity = body.filter(p => p.type === 'carry').length * 50
  }
  if (capacity === 0) return { used: 0, capacity: 0 }

  let used = 0
  if (obj.store && typeof obj.store === 'object') {
    // Avoid Object.values allocation
    const storeObj = obj.store as Record<string, unknown>
    for (const k in storeObj) {
      const v = storeObj[k]
      if (typeof v === 'number') used += v
    }
  } else if (typeof obj.energy === 'number') {
    used = obj.energy
  }
  return { used, capacity }
}

function calcCreepFillRadius(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return CREEP_INNER_R * 0.8 * Math.min(1, used / capacity)
}

function updateCreepFill(visual: Container, radius: number): void {
  const fill = (visual as Container & { __creepFillGraphics?: Graphics }).__creepFillGraphics
  if (!fill) return
  fill.clear()
  if (radius > 0) {
    fill.circle(0, 0, radius)
    fill.fill(ENERGY_FILL)
  }
}

function getObjectColor(type: string): number {
  return OBJECT_COLORS[type] ?? OBJ_DEFAULT
}

function getExtensionEnergy(obj: RoomObject): { energy: number; capacity: number } {
  let capacity = 50
  if (typeof obj.energyCapacity === 'number') {
    capacity = obj.energyCapacity
  } else if (typeof obj.storeCapacity === 'number') {
    capacity = obj.storeCapacity
  } else if (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object') {
    const cap = obj.storeCapacityResource as Record<string, number>
    capacity = cap.energy ?? 50
  }

  let energy = 0
  if (typeof obj.energy === 'number') {
    energy = obj.energy
  } else if (obj.store && typeof obj.store === 'object') {
    const store = obj.store as Record<string, number>
    energy = store.energy ?? 0
  }

  return { energy, capacity }
}

function extScale(capacity: number): number {
  if (capacity >= 200) return 1.15
  if (capacity >= 100) return 0.85
  return 0.70
}

function calcExtensionFillRadius(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return EXT_INNER_R * extScale(capacity) * Math.min(1, energy / capacity)
}

// Links show their energy as a diamond core that scales with stored energy,
// matching the link's diamond outline. The fraction is the linear scale of the
// inner diamond (half-extents below mirror the linkInner geometry in the draw).
const LINK_FILL_DX = TILE_SIZE * 0.25
const LINK_FILL_DY = TILE_SIZE * 0.30
function calcLinkFillFraction(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return Math.min(1, energy / capacity)
}
function updateLinkFill(visual: ContainerWithTarget, fraction: number): void {
  const fill = visual.__linkFillGraphics
  if (!fill) return
  fill.clear()
  if (fraction <= 0) return
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const dx = LINK_FILL_DX * fraction
  const dy = LINK_FILL_DY * fraction
  fill.poly([cx, cy - dy, cx + dx, cy, cx, cy + dy, cx - dx, cy])
  fill.fill(ST_ENERGY)
}

function drawExtensionVisual(container: Container, energy: number, capacity: number, outlineColor: number): void {
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const scale = extScale(capacity)
  const g = new Graphics()
  g.circle(cx, cy, EXT_OUTER_R * scale)
  g.fill(ST_DARK)
  g.circle(cx, cy, EXT_OUTER_R * scale)
  g.stroke({ width: EXT_STROKE_W * scale, color: outlineColor })
  g.circle(cx, cy, EXT_INNER_R * scale)
  g.fill(ST_LIGHT)
  container.addChild(g)

  const fill = new Graphics()
  const radius = calcExtensionFillRadius(energy, capacity)
  if (radius > 0) {
    fill.circle(cx, cy, radius)
    fill.fill(ST_ENERGY)
  }
  container.addChild(fill)
  ;(container as Container & { __fillGraphics?: Graphics }).__fillGraphics = fill
}

function updateExtensionFill(visual: Container, radius: number): void {
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const fill = (visual as Container & { __fillGraphics?: Graphics }).__fillGraphics
  if (!fill) return
  fill.clear()
  if (radius > 0) {
    fill.circle(cx, cy, radius)
    fill.fill(ST_ENERGY)
  }
}

const TOWER_BODY_X = -TILE_SIZE * 0.4
const TOWER_BODY_Y = -TILE_SIZE * 0.3
const TOWER_BODY_W = TILE_SIZE * 0.8
const TOWER_BODY_H = TILE_SIZE * 0.6

const TOWER_IDLE_SPEED = 0.4   // rad/s idle barrel sweep
const TOWER_AIM_LERP   = 0.3   // per-frame fraction of remaining angle when turning to a target
const EXTRACTOR_RING_SPEED = Math.PI / 6  // rad/s — one full turn every 12s
// Barrel art points "up" (−y) at rotation 0, so a target at screen angle θ needs
// rotation θ + π/2. Flip the sign / drop the offset if the body sprite faces elsewhere.
const TOWER_BARREL_FORWARD = Math.PI / 2

// Rotate `current` toward `target` by fraction `t`, taking the shortest path.
function approachAngle(current: number, target: number, t: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  else if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * t
}

const CONT_W = TILE_SIZE * 0.45
const CONT_H = TILE_SIZE * 0.6
const CONT_X = TILE_SIZE * 0.275  // cx - TILE_SIZE * 0.225
const CONT_Y = TILE_SIZE * 0.2    // cy - TILE_SIZE * 0.3
const CONT_MARGIN = Math.max(0.5, TILE_SIZE * 0.02)  // frames the grey interior and insets the fill bands

// Returns the fill level as a fraction [0,1] so the same value drives both the
// procedural-fallback rect and the atlas rounded-rect geometry.
function calcTowerFillHeight(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return Math.min(1, energy / capacity)
}

function updateTowerFill(visual: ContainerWithTarget, level: number): void {
  const fill = visual.__towerFillGraphics
  if (!fill) return
  fill.clear()
  if (level <= 0) return
  // Atlas tower: rounded-rect fill rising from the bottom of the body, in the
  // body's render-scaled coordinate space (geometry precomputed at load time).
  const geom = visual.__towerFillRect
  if (geom) {
    const h = geom.heightMax * level
    const y = geom.yMin + geom.heightMax - h
    const r = Math.min(geom.rx, geom.width / 2, h / 2)
    fill.roundRect(geom.x, y, geom.width, h, r)
    fill.fill(ST_ENERGY)
    return
  }
  // Procedural-fallback tower: plain rect inside the drawn body.
  const margin = Math.max(0.5, TILE_SIZE * 0.02)
  const h = TOWER_BODY_H * level
  fill.rect(TOWER_BODY_X + margin, TOWER_BODY_Y + TOWER_BODY_H - h + margin, TOWER_BODY_W - margin * 2, h - margin * 2)
  fill.fill(ST_ENERGY)
}

// ── Storage helpers ────────────────────────────────────────────────────────
// Box inner rect in container coords (cx = cy = TILE_SIZE/2, so rect x = 0, rect y = -TILE_SIZE*0.1)
const STORAGE_BOX_X = 0
const STORAGE_BOX_Y = -TILE_SIZE * 0.1
const STORAGE_BOX_W = TILE_SIZE * 1.0
const STORAGE_BOX_H = TILE_SIZE * 1.2

interface StoreBand { color: number; amount: number }

// Resources pinned to the bottom of the stack, in this order; others follow alphabetically.
const BAND_ORDER = ['energy', 'power']

// Break a store into stacked, colored bands ordered bottom-up. `used` is the sum of
// the band amounts, so callers size the fill from a single total exactly as before;
// `dominant` is the highest-amount resource (null when empty), for single-tint structures.
function getStoreBands(obj: RoomObject): { bands: StoreBand[]; used: number; capacity: number; dominant: string | null } {
  const capacity = typeof obj.storeCapacity === 'number' ? obj.storeCapacity : 0
  if (capacity === 0 || !obj.store || typeof obj.store !== 'object') {
    return { bands: [], used: 0, capacity: 0, dominant: null }
  }
  const store = obj.store as Record<string, unknown>
  const entries: Array<[string, number]> = []
  let dominant: string | null = null
  let dominantAmt = 0
  for (const k in store) {
    const v = store[k]
    if (typeof v === 'number' && v > 0) {
      entries.push([k, v])
      if (v > dominantAmt) { dominantAmt = v; dominant = k }
    }
  }
  entries.sort(([a], [b]) => {
    const ra = BAND_ORDER.indexOf(a), rb = BAND_ORDER.indexOf(b)
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || (a < b ? -1 : a > b ? 1 : 0)
  })
  let used = 0
  const bands = entries.map(([res, amount]): StoreBand => {
    used += amount
    return { color: RESOURCE_COLORS[res] ?? ST_RESOURCE_OTHER, amount }
  })
  return { bands, used, capacity, dominant }
}

// Stack resource bands bottom-up inside a box. `yBottom` is the box floor; `height` is the
// (animated) total fill height; bands sum to `used`. `margin` insets the whole envelope on
// all sides — bands stay contiguous within it. Falls back to a solid energy fill if bands
// are missing, matching the previous single-color behavior.
function drawStoreBands(
  fill: Graphics,
  x: number, yBottom: number, width: number,
  height: number, bands: StoreBand[] | undefined, used: number,
  margin = 0,
): void {
  if (height <= 0 || used <= 0) return
  const innerX = x + margin
  const innerW = width - margin * 2
  const totalH = height - margin * 2
  const baseY = yBottom - margin
  if (totalH <= 0) return
  if (!bands || bands.length === 0) {
    fill.rect(innerX, baseY - totalH, innerW, totalH)
    fill.fill(ST_ENERGY)
    return
  }
  let y = baseY
  for (const band of bands) {
    const h = totalH * (band.amount / used)
    if (h > 0) {
      fill.rect(innerX, y - h, innerW, h)
      fill.fill(band.color)
    }
    y -= h
  }
}

// Bands differ if their colours/amounts differ — used to refresh a fill whose total is
// unchanged but whose composition (and so its colours) changed this tick.
function bandsEqual(a: StoreBand[] | undefined, b: StoreBand[]): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < b.length; i++) {
    if (a[i]!.color !== b[i]!.color || a[i]!.amount !== b[i]!.amount) return false
  }
  return true
}

function calcContainerFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return CONT_H * Math.min(1, used / capacity)
}

function updateContainerFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__containerFillG
  if (!fill) return
  fill.clear()
  drawStoreBands(fill, CONT_X, CONT_Y + CONT_H, CONT_W, height, visual.__containerBands, visual.__containerUsed ?? 0, CONT_MARGIN)
}

function calcStorageFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return STORAGE_BOX_H * Math.min(1, used / capacity)
}

function updateStorageFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__storageFillG
  if (!fill) return
  fill.clear()
  drawStoreBands(fill, STORAGE_BOX_X, STORAGE_BOX_Y + STORAGE_BOX_H, STORAGE_BOX_W, height, visual.__storageBands, visual.__storageUsed ?? 0)
}

// ── Terminal / lab / nuker / factory fills ──────────────────────────────────
// These structures tint their fill by resource type (shared band palette), rather
// than showing only how full they are.
function resourceColor(res: string): number {
  return RESOURCE_COLORS[res] ?? ST_RESOURCE_OTHER
}

function calcCenterFillFraction(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return Math.min(1, used / capacity)
}

// Terminal: a square that grows from the plate centre, tinted by the dominant resource.
const TERMINAL_FILL_HALF = TILE_SIZE * 0.35
function updateTerminalFill(visual: ContainerWithTarget, fraction: number): void {
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

// Lab: energy fills the base bar (left→right); the single stored mineral fills the bowl
// as a disc from the centre, drawn behind the bar and tinted by mineral type.
const LAB_BOWL_DY     = TILE_SIZE * 0.025
const LAB_FILL_MAX_R  = TILE_SIZE * 0.36
const LAB_BAR_X       = TILE_SIZE * 0.05
const LAB_BAR_Y       = TILE_SIZE * 0.8
const LAB_BAR_W       = TILE_SIZE * 0.9
const LAB_BAR_H       = TILE_SIZE * 0.25
const LAB_ENERGY_CAP  = 2000   // fallback when the server omits per-resource caps
const LAB_MINERAL_CAP = 3000

function getLabContents(obj: RoomObject): {
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

function updateLabFill(visual: ContainerWithTarget, energyFraction: number, mineralFraction: number): void {
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

// Nuker: energy fills the inner triangle bottom→top; ghodium fills a bar across the base.
const NUKER_ENERGY_CAP_FALLBACK = 300000
const NUKER_GHODIUM_CAP = 5000
const NUKER_TRI_APEX_Y = -0.8
const NUKER_TRI_BASE_Y = 0.2
const NUKER_TRI_HALF   = 0.4
const NUKER_BAR_X0 = -0.34, NUKER_BAR_X1 = 0.34, NUKER_BAR_Y0 = 0.27, NUKER_BAR_Y1 = 0.45

function getNukerContents(obj: RoomObject): {
  energy: number; energyCap: number; ghodium: number; ghodiumCap: number
} {
  const store = (obj.store && typeof obj.store === 'object') ? obj.store as Record<string, number> : {}
  const caps = (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object')
    ? obj.storeCapacityResource as Record<string, number> : {}
  const energy = typeof store.energy === 'number' ? store.energy : 0
  const energyCap = typeof caps.energy === 'number' ? caps.energy
    : typeof obj.storeCapacity === 'number' ? obj.storeCapacity : NUKER_ENERGY_CAP_FALLBACK
  const ghodium = typeof store.G === 'number' ? store.G : 0
  const ghodiumCap = typeof caps.G === 'number' ? caps.G : NUKER_GHODIUM_CAP
  return { energy, energyCap, ghodium, ghodiumCap }
}

function updateNukerFill(visual: ContainerWithTarget, energyFraction: number, ghodiumFraction: number): void {
  const c = TILE_SIZE / 2
  const tri = visual.__nukerEnergyG
  if (tri) {
    tri.clear()
    if (energyFraction > 0) {
      const span = NUKER_TRI_BASE_Y - NUKER_TRI_APEX_Y
      const topY = NUKER_TRI_BASE_Y - span * energyFraction
      const halfAt = NUKER_TRI_HALF * (topY - NUKER_TRI_APEX_Y) / span
      tri.poly([
        c + halfAt * TILE_SIZE, c + topY * TILE_SIZE,
        c + NUKER_TRI_HALF * TILE_SIZE, c + NUKER_TRI_BASE_Y * TILE_SIZE,
        c - NUKER_TRI_HALF * TILE_SIZE, c + NUKER_TRI_BASE_Y * TILE_SIZE,
        c - halfAt * TILE_SIZE, c + topY * TILE_SIZE,
      ])
      tri.fill(ST_ENERGY)
    }
  }
  const bar = visual.__nukerGhodiumG
  if (bar) {
    bar.clear()
    if (ghodiumFraction > 0) {
      const x = c + NUKER_BAR_X0 * TILE_SIZE
      const y = c + NUKER_BAR_Y0 * TILE_SIZE
      const w = (NUKER_BAR_X1 - NUKER_BAR_X0) * TILE_SIZE
      const h = (NUKER_BAR_Y1 - NUKER_BAR_Y0) * TILE_SIZE
      bar.rect(x, y, w * ghodiumFraction, h)
      bar.fill(resourceColor('G'))
    }
  }
}

// Factory: a compact cog — short stubby teeth forming the gear silhouette, a level ring
// around the centre, and a storage-style band fill in the centre box. The green outline
// pulses while producing (it does not recolour the teeth themselves).
const FACT_TEETH      = 8
const FACT_BODY_R     = TILE_SIZE * 0.4       // body disc / tooth valley radius
const FACT_TOOTH_OUT  = TILE_SIZE * 0.5       // tooth tips reach the tile edge
const FACT_TOOTH_HALF = 0.22                  // radians, half angular width of a tooth
const FACT_RING_IN    = TILE_SIZE * 0.25
const FACT_RING_OUT   = TILE_SIZE * 0.32
const FACT_BOX_W      = TILE_SIZE * 0.24
const FACT_BOX_H      = TILE_SIZE * 0.28
const FACT_BOX_X      = TILE_SIZE * 0.38      // centred: 0.5 - 0.12
const FACT_BOX_Y      = TILE_SIZE * 0.36      // centred: 0.5 - 0.14
const FACT_LEVELS     = 5
const FACT_GLOW       = 0xFFFFFF              // pulse brightens the outline toward white

// One closed polygon tracing the whole cog perimeter: body-radius arcs in the valleys,
// outer-radius arcs across the tooth tips, with the radial rises/falls between them as
// the straight segments the poly draws automatically. Filled it is a solid gear.
function factoryGearPoints(): number[] {
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
const FACT_GEAR_PTS = factoryGearPoints()

function factoryActive(obj: RoomObject): boolean {
  return typeof obj.cooldown === 'number' && obj.cooldown > 0
}

function drawFactoryGear(g: Graphics, strokeColor: number): void {
  g.clear()
  g.poly(FACT_GEAR_PTS)
  g.fill(ST_DARK)
  g.poly(FACT_GEAR_PTS)
  g.stroke({ width: TILE_SIZE * 0.06, color: strokeColor })
}

function drawFactoryRing(g: Graphics, level: number): void {
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

function calcFactoryFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return FACT_BOX_H * Math.min(1, used / capacity)
}

function updateFactoryFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__factoryFillG
  if (!fill) return
  fill.clear()
  const margin = Math.max(0.5, TILE_SIZE * 0.03)
  drawStoreBands(fill, FACT_BOX_X, FACT_BOX_Y + FACT_BOX_H, FACT_BOX_W, height, visual.__factoryBands, visual.__factoryUsed ?? 0, margin)
}

// ── Controller helpers ─────────────────────────────────────────────────────

const CTRL_OCTO_R  = TILE_SIZE * 0.65
const CTRL_SEG_OUT = CTRL_OCTO_R
const CTRL_SEG_IN  = TILE_SIZE * 0.42

function drawControllerSegments(
  g: Graphics,
  cx: number, cy: number,
  outerR: number, innerR: number,
  level: number, progress: number, progressTotal: number,
): void {
  g.clear()
  const SEG_COUNT  = 8
  const gapAngle   = 0.10
  const segArc     = (2 * Math.PI / SEG_COUNT) - gapAngle

  for (let i = 0; i < SEG_COUNT; i++) {
    const a0 = -Math.PI / 2 + i * (2 * Math.PI / SEG_COUNT) + gapAngle / 2
    const a1 = a0 + segArc
    const sx = cx + innerR * Math.cos(a0)
    const sy = cy + innerR * Math.sin(a0)

    if (i < level) {
      g.moveTo(sx, sy)
      g.arc(cx, cy, outerR, a0, a1)
      g.arc(cx, cy, innerR, a1, a0, true)
      g.closePath()
      g.fill({ color: 0xdddddd, alpha: 0.9 })
    } else if (i === level && progressTotal > 0) {
      g.moveTo(sx, sy)
      g.arc(cx, cy, outerR, a0, a1)
      g.arc(cx, cy, innerR, a1, a0, true)
      g.closePath()
      g.fill({ color: 0x1e1e1e, alpha: 0.85 })
      if (progress > 0) {
        const ratio = Math.min(1, progress / progressTotal)
        const pe = a0 + segArc * ratio
        g.moveTo(sx, sy)
        g.arc(cx, cy, outerR, a0, pe)
        g.arc(cx, cy, innerR, pe, a0, true)
        g.closePath()
        g.fill({ color: 0xdddddd, alpha: 0.9 })
      }
    } else {
      g.moveTo(sx, sy)
      g.arc(cx, cy, outerR, a0, a1)
      g.arc(cx, cy, innerR, a1, a0, true)
      g.closePath()
      g.fill({ color: 0x1e1e1e, alpha: 0.6 })
    }
  }
}

function updateControllerSegSprites(container: ContainerWithTarget, level: number, progress: number, progressTotal: number): void {
  const segs = container.__ctrlSegSprites
  if (!segs) return
  for (let i = 0; i < segs.length; i++) {
    if (i < level) {
      segs[i]!.alpha = 1.0
    } else if (i === level && progressTotal > 0) {
      segs[i]!.alpha = Math.max(0.15, progress / progressTotal)
    } else {
      segs[i]!.alpha = 0.15
    }
  }
}

function isForeignCreep(obj: RoomObject, currentUserId?: string): boolean {
  const creepUser = obj.user
  if (typeof creepUser !== 'string') return false
  if (!currentUserId) return false
  return creepUser !== currentUserId
}

function createObjectVisual(
  obj: RoomObject,
  showLabel = true,
  currentUserId?: string,
  _badge?: Badge,
  badgeCache?: BadgeTextureCache,
  users?: Record<string, { _id: string; username: string; badge?: Badge }>,
  theme?: Theme | null,
  atlasCache?: AtlasCache | null,
): Container {
  const container = new Container()
  const g = new Graphics()
  const color = getObjectColor(obj.type)
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2

  // Foreign-owned structures swap their outline (normally ST_OUTLINE green) for OBJ_FOREIGN red.
  const ownedByUser = typeof obj.user === 'string' ? obj.user : undefined
  const isForeignOwned = ownedByUser !== undefined && currentUserId !== undefined && ownedByUser !== currentUserId
  const outlineColor = isForeignOwned ? OBJ_FOREIGN : ST_OUTLINE

  switch (obj.type) {
    case 'creep': {
      const FULL = 2 * Math.PI

      const bodyContainer = new Container()
      bodyContainer.position.set(cx, cy)
      bodyContainer.rotation = -Math.PI / 2

      const isForeign = isForeignCreep(obj, currentUserId)
      if (isForeign) {
        const borderG = new Graphics()
        borderG.circle(0, 0, CREEP_OUTER_R + 0.75)
        borderG.stroke({ width: 1.5, color: OBJ_FOREIGN })
        bodyContainer.addChild(borderG)
      }

      const bgG = new Graphics()
      bgG.circle(0, 0, CREEP_OUTER_R)
      bgG.fill(BG_DEEP)
      bodyContainer.addChild(bgG)

      // Count body parts by zone
      const bodyParts = (obj.body as Array<{ type: string }> | undefined) ?? []
      let workCount = 0
      let moveCount = 0
      let otherTotal = 0
      const otherOrder: string[] = []
      const otherCounts: Record<string, number> = {}
      for (const part of bodyParts) {
        if (part.type === 'work') {
          workCount++
        } else if (part.type === 'move') {
          moveCount++
        } else {
          if (otherCounts[part.type] === undefined) {
            otherOrder.push(part.type)
            otherCounts[part.type] = 0
          }
          otherCounts[part.type]!++
          otherTotal++
        }
      }

      // Proportional angle allocations (relative to MAX_BODY=50)
      const workAngle  = (workCount  / CREEP_MAX_BODY) * FULL
      const moveAngle  = (moveCount  / CREEP_MAX_BODY) * FULL
      const otherAngle = (otherTotal / CREEP_MAX_BODY) * FULL

      // Zone boundaries (local space: 0 = top after -π/2 rotation, clockwise)
      // WORK: centered at local 0 (top)
      // MOVE: centered at local π (bottom)
      // OTHER: split left/right, adjacent to WORK, filling toward MOVE
      // DARK: remaining space between OTHER and MOVE
      const workEnd        = workAngle / 2
      const rightOtherEnd  = workEnd + otherAngle / 2
      const moveStart      = Math.PI - moveAngle / 2
      const moveEnd        = Math.PI + moveAngle / 2
      const leftOtherStart = FULL - workAngle / 2 - otherAngle / 2
      const leftOtherEnd   = FULL - workAngle / 2

      const arcsG = new Graphics()

      // 1. WORK — top, centered
      if (workAngle > 0) {
        drawCreepArc(arcsG, -workAngle / 2, workEnd, BODY_PART_COLORS['work'] ?? 0xffe56d)
      }

      // 2. RIGHT OTHER — clockwise from WORK, filling toward MOVE
      let rightCur = workEnd
      for (const type of otherOrder) {
        const angle = ((otherCounts[type] ?? 0) / CREEP_MAX_BODY) * FULL / 2
        drawCreepArc(arcsG, rightCur, rightCur + angle, BODY_PART_COLORS[type] ?? 0x777777)
        rightCur += angle
      }

      // 3. RIGHT DARK
      drawCreepArc(arcsG, rightOtherEnd, moveStart, CREEP_RING_DARK)

      // 4. MOVE — bottom, centered
      if (moveAngle > 0) {
        drawCreepArc(arcsG, moveStart, moveEnd, BODY_PART_COLORS['move'] ?? 0xa9b7c6)
      }

      // 5. LEFT DARK
      drawCreepArc(arcsG, moveEnd, leftOtherStart, CREEP_RING_DARK)

      // 6. LEFT OTHER — filling from WORK downward (counter-clockwise = reverse order, drawn as clockwise arcs)
      let leftCur = leftOtherEnd
      for (const type of otherOrder) {
        const angle = ((otherCounts[type] ?? 0) / CREEP_MAX_BODY) * FULL / 2
        drawCreepArc(arcsG, leftCur - angle, leftCur, BODY_PART_COLORS[type] ?? 0x777777)
        leftCur -= angle
      }

      bodyContainer.addChild(arcsG)

      // Inner dark circle
      const innerG = new Graphics()
      innerG.circle(0, 0, CREEP_INNER_R)
      innerG.fill(BG_DARK)
      bodyContainer.addChild(innerG)

      // Center indicator: owner's badge if available, red fill for foreign/NPC without badge
      const creepUserId = typeof obj.user === 'string' ? obj.user : undefined
      const creepBadge = creepUserId ? users?.[creepUserId]?.badge : undefined
      if (creepBadge && badgeCache) {
        const badgeSprite = new Sprite()
        badgeSprite.anchor.set(0.5, 0.5)
        const size = CREEP_INNER_R * 2
        badgeSprite.width = size
        badgeSprite.height = size
        badgeSprite.rotation = Math.PI / 2
        bodyContainer.addChild(badgeSprite)
        ;(container as ContainerWithTarget).__creepBadgeSprite = badgeSprite
        badgeCache.getOrCreate(creepBadge as Badge).then((texture) => {
          if (!badgeSprite.destroyed) {
            badgeSprite.texture = texture
          }
        }).catch(() => {})
      } else if (isForeign) {
        const markG = new Graphics()
        markG.circle(0, 0, CREEP_INNER_R * 0.82)
        markG.fill({ color: OBJ_FOREIGN, alpha: 0.9 })
        bodyContainer.addChild(markG)
        ;(container as ContainerWithTarget).__creepForeignMark = markG
      }

      // Store fill (animated, updated on store changes)
      const { used, capacity } = getCreepStore(obj)
      const fillRadius = calcCreepFillRadius(used, capacity)
      const fillG = new Graphics()
      if (fillRadius > 0) {
        fillG.circle(0, 0, fillRadius)
        fillG.fill(ENERGY_FILL)
      }
      bodyContainer.addChild(fillG)
      ;(container as ContainerWithTarget).__creepFillGraphics = fillG
      ;(container as ContainerWithTarget).__creepUsed = used
      ;(container as ContainerWithTarget).__creepCapacity = capacity

      // Direction indicator (notch pointing right = local angle 0)
      const midR   = (CREEP_OUTER_R + CREEP_INNER_R) / 2
      const halfH  = (CREEP_OUTER_R - CREEP_INNER_R) * 0.45
      const notchG = new Graphics()
      notchG.moveTo(CREEP_OUTER_R, 0)
      notchG.lineTo(midR, -halfH)
      notchG.lineTo(midR,  halfH)
      notchG.closePath()
      notchG.fill(CREEP_NOTCH)
      bodyContainer.addChild(notchG)

      container.addChild(bodyContainer)
      ;(container as ContainerWithTarget).__bodyContainer = bodyContainer
      break
    }
    case 'extension': {
      const { energy, capacity } = getExtensionEnergy(obj)
      drawExtensionVisual(container, energy, capacity, outlineColor)
      ;(container as Container & { __extEnergy?: number; __extCapacity?: number }).__extEnergy = energy
      ;(container as Container & { __extEnergy?: number; __extCapacity?: number }).__extCapacity = capacity
      break
    }
    case 'spawn': {
      g.circle(cx, cy, TILE_SIZE * 0.65)
      g.fill(ST_DARK)
      g.circle(cx, cy, TILE_SIZE * 0.65)
      g.stroke({ width: TILE_SIZE * 0.1, color: 0xcccccc })
      g.circle(cx, cy, TILE_SIZE * 0.4)
      g.fill(ST_ENERGY)
      // Ring sits in the dark moat and must render above the body `g` (whose
      // dark disc is added after the switch) — sort children by zIndex so it does.
      // Initial draw is best-effort; ObjectLayer.update() drives it per-tick.
      container.sortableChildren = true
      const spawnRing = new Graphics()
      spawnRing.zIndex = 1
      const t = spawnTiming(obj, 0)
      const ratio = t ? spawnRatio(t.needTime, t.endTime, 0) : null
      drawSpawnRing(spawnRing, ratio)
      container.addChild(spawnRing)
      const cwt = container as ContainerWithTarget
      cwt.__spawnRing = spawnRing
      cwt.__spawnRatio = ratio
      if (t) { cwt.__spawnNeedTime = t.needTime; cwt.__spawnEndTime = t.endTime }
      cwt.__spawnSig = spawnSig(obj)
      break
    }
    case 'powerSpawn': {
      g.circle(cx, cy, TILE_SIZE * 0.65)
      g.fill(ST_DARK)
      g.circle(cx, cy, TILE_SIZE * 0.65)
      g.stroke({ width: TILE_SIZE * 0.1, color: ST_POWER })
      g.circle(cx, cy, TILE_SIZE * 0.4)
      g.fill(ST_ENERGY)
      break
    }
    case 'source': {
      const { energy, capacity } = getSourceEnergy(obj)
      const size = calcSourceSize(energy, capacity)
      const srcG = new Graphics()
      drawSourceVisual(srcG, size, performance.now())
      container.addChild(srcG)
      ;(container as ContainerWithTarget).__sourceGraphics = srcG
      ;(container as ContainerWithTarget).__sourceEnergy = energy
      ;(container as ContainerWithTarget).__sourceCapacity = capacity
      ;(container as ContainerWithTarget).__sourceSize = size
      break
    }
    case 'constructionSite': {
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
      break
    }
    case 'mineral': {
      const mtype = typeof obj.mineralType === 'string' ? obj.mineralType : '?'
      const mineralSpec = theme?.mineral
      if (mineralSpec && atlasCache) {
        const frame = `mineral/${mtype}`
        const targetSize = TILE_SIZE * mineralSpec.tileScale
        const applyTexture = (sprite: Sprite, tex: Texture) => {
          sprite.texture = tex
          sprite.width = targetSize
          sprite.height = targetSize
        }
        const sprite = new Sprite()
        sprite.anchor.set(0.5, 0.5)
        sprite.x = cx
        sprite.y = cy
        container.addChild(sprite)
        const tex = atlasCache.getTexture(theme!.atlasUrl, frame)
        if (tex) {
          applyTexture(sprite, tex)
        } else {
          atlasCache.getOrLoad(theme!.atlasUrl).then(sheet => {
            if (!sprite.destroyed) applyTexture(sprite, sheet.textures[frame] ?? Texture.EMPTY)
          }).catch(() => {})
        }
      } else {
        // Fallback: colored disc + letter glyph
        const mcolor = RESOURCE_COLORS[mtype] ?? OBJ_CYAN
        const textColor = MINERAL_TEXT_COLORS[mtype] ?? 0xFFFFFF
        const discG = new Graphics()
        discG.circle(cx, cy, MINERAL_R)
        discG.fill(mcolor)
        container.addChild(discG)
        const glyph = new Text({
          text: mtype,
          style: { fontSize: MINERAL_GLYPH_FONT, fill: textColor, fontWeight: 'bold' },
        })
        glyph.anchor.set(0.5, 0.5)
        glyph.scale.set(MINERAL_GLYPH_SCALE)
        glyph.position.set(cx, cy)
        container.addChild(glyph)
      }
      break
    }
    case 'deposit': {
      const depType = typeof obj.depositType === 'string' ? obj.depositType : undefined
      const depSpec = theme?.deposit
      if (depType && depSpec && atlasCache) {
        const targetSize = TILE_SIZE * depSpec.tileScale
        const applyTexture = (sprite: Sprite, tex: Texture) => {
          sprite.texture = tex
          sprite.width = targetSize
          sprite.height = targetSize
        }
        // Two stacked layers: the rock shape, then the commodity fill on top —
        // both tinted by type; the fill is kept mostly transparent.
        const tintColor = DEPOSIT_COLORS[depType]
        for (const frame of [`deposit/${depType}/shape`, `deposit/${depType}/fill`]) {
          const isFill = frame.endsWith('/fill')
          const sprite = new Sprite()
          sprite.anchor.set(0.5, 0.5)
          sprite.x = cx
          sprite.y = cy
          if (tintColor !== undefined) sprite.tint = tintColor
          if (isFill) sprite.alpha = DEPOSIT_FILL_ALPHA
          container.addChild(sprite)
          const tex = atlasCache.getTexture(theme!.atlasUrl, frame)
          if (tex) {
            applyTexture(sprite, tex)
          } else {
            atlasCache.getOrLoad(theme!.atlasUrl).then(sheet => {
              if (!sprite.destroyed) applyTexture(sprite, sheet.textures[frame] ?? Texture.EMPTY)
            }).catch(() => {})
          }
        }
        break
      }
      // Fallback: colored rect (no theme/atlas or unknown deposit type)
      g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
      g.fill(color)
      container.addChild(g)
      break
    }
    case 'controller': {
      const level        = typeof obj.level         === 'number' ? obj.level         : 0
      const progress     = typeof obj.progress      === 'number' ? obj.progress      : 0
      const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 0

      const resObj = obj.reservation as { user?: string } | undefined
      const ctrlUserId = typeof obj.user === 'string' ? obj.user
        : typeof resObj?.user === 'string' ? resObj.user
        : undefined
      const ctrlBadge = ctrlUserId ? users?.[ctrlUserId]?.badge : undefined

      const ctrlSpec: ControllerSpec | undefined = theme?.controller
      if (ctrlSpec && atlasCache) {
        const targetSize = TILE_SIZE * ctrlSpec.tileScale
        const segScale = targetSize / 600

        const bgSprite = new Sprite()
        bgSprite.anchor.set(0.5, 0.5)
        bgSprite.x = cx
        bgSprite.y = cy
        bgSprite.width = targetSize
        bgSprite.height = targetSize
        container.addChild(bgSprite)

        const segSprites: Sprite[] = []
        for (let i = 0; i < 8; i++) {
          const seg = new Sprite()
          seg.anchor.set(0.5, 0.5)
          seg.x = cx
          seg.y = cy
          seg.scale.set(segScale)
          seg.rotation = i * (Math.PI / 4)
          container.addChild(seg)
          segSprites.push(seg)
        }
        ;(container as ContainerWithTarget).__ctrlSegSprites = segSprites
        updateControllerSegSprites(container as ContainerWithTarget, level, progress, progressTotal)

        const loadAtlas = (): Promise<import('pixi.js').Spritesheet> => atlasCache.getOrLoad(theme!.atlasUrl)
        const bgTex = atlasCache.getTexture(theme!.atlasUrl, ctrlSpec.backgroundFrame)
        if (bgTex) {
          bgSprite.texture = bgTex
        } else {
          loadAtlas().then(sheet => {
            if (!bgSprite.destroyed) bgSprite.texture = sheet.textures[ctrlSpec.backgroundFrame] ?? Texture.EMPTY
          }).catch(() => {})
        }
        const existingSegTex = atlasCache.getTexture(theme!.atlasUrl, ctrlSpec.segmentFrame)
        if (existingSegTex) {
          for (const seg of segSprites) seg.texture = existingSegTex
        } else {
          loadAtlas().then(sheet => {
            const tex = sheet.textures[ctrlSpec.segmentFrame] ?? Texture.EMPTY
            for (const seg of segSprites) { if (!seg.destroyed) seg.texture = tex }
          }).catch(() => {})
        }
      } else {
        // Graphics fallback: octagon + arc segments
        const octoG = new Graphics()
        const octopts: number[] = []
        for (let i = 0; i < 8; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 4
          octopts.push(cx + CTRL_OCTO_R * Math.cos(angle), cy + CTRL_OCTO_R * Math.sin(angle))
        }
        octoG.poly(octopts)
        octoG.fill(0x222831)
        octoG.poly(octopts)
        octoG.stroke({ width: TILE_SIZE * 0.07, color: 0x7A7E85 })
        container.addChild(octoG)

        const segG = new Graphics()
        drawControllerSegments(segG, cx, cy, CTRL_SEG_OUT, CTRL_SEG_IN, level, progress, progressTotal)
        container.addChild(segG)
        ;(container as ContainerWithTarget).__ctrlSegGraphics = segG
      }

      ;(container as ContainerWithTarget).__ctrlLevel         = level
      ;(container as ContainerWithTarget).__ctrlProgress      = progress
      ;(container as ContainerWithTarget).__ctrlProgressTotal = progressTotal
      ;(container as ContainerWithTarget).__ctrlDowngradeTime = typeof obj.downgradeTime === 'number' ? obj.downgradeTime : undefined
      ;(container as ContainerWithTarget).__ctrlUserId        = ctrlUserId

      // Inner circle — backdrop behind badge (owned) or neutral disc + center dot (unowned)
      const innerCircleG = new Graphics()
      if (ctrlBadge) {
        innerCircleG.circle(cx, cy, CTRL_SEG_IN)
        innerCircleG.fill(ST_DARK)
      } else {
        innerCircleG.circle(cx, cy, CTRL_SEG_IN)
        innerCircleG.fill(0x2E343F)
        innerCircleG.circle(cx, cy, CTRL_SEG_IN)
        innerCircleG.stroke({ width: TILE_SIZE * 0.04, color: 0x7A7E85 })
        innerCircleG.circle(cx, cy, TILE_SIZE * 0.16)
        innerCircleG.fill(0x9AA0A8)
      }
      container.addChild(innerCircleG)

      if (ctrlBadge && badgeCache) {
        const bs = new Sprite()
        bs.anchor.set(0.5, 0.5)
        bs.width  = CTRL_SEG_IN * 2
        bs.height = CTRL_SEG_IN * 2
        bs.position.set(cx, cy)
        const bsMask = new Graphics()
        bsMask.circle(cx, cy, CTRL_SEG_IN)
        bsMask.fill(0xffffff)
        container.addChild(bs)
        bs.mask = bsMask
        container.addChild(bsMask)
        badgeCache.getOrCreate(ctrlBadge as Badge).then((tex) => { if (!bs.destroyed) bs.texture = tex }).catch(() => {})
      }

      break
    }
    case 'energy': {
      g.circle(cx, cy, TILE_SIZE * 0.2)
      g.fill(ST_ENERGY)
      break
    }
    case 'road': {
      // Intentionally left empty: rendering is batched in ObjectLayer's roadGraphics
      // but we still need the empty container for selection tracking
      break
    }
    case 'constructedWall': {
      // Intentionally left empty: rendering is batched in ObjectLayer's wallGraphics
      // but we still need the empty container for selection tracking
      break
    }
    case 'rampart': {
      // Intentionally left empty: rendering is batched in ObjectLayer's rampartGraphics
      // but we still need the empty container for selection tracking
      break
    }
    case 'tower': {
      const { energy: towerEnergy, capacity: towerCap } = getExtensionEnergy(obj)

      const towerSpec = theme?.tower
      if (towerSpec && atlasCache) {
        const targetSize = TILE_SIZE * towerSpec.tileScale

        // Static ring (footprint, tinted by ownership)
        const ring = new Sprite()
        ring.anchor.set(0.5, 0.5)
        ring.position.set(cx, cy)
        ring.tint = outlineColor
        container.addChild(ring)

        // Rotating turret: body cannon + energy fill, pivot at tile center
        const turret = new Container()
        turret.position.set(cx, cy)
        container.addChild(turret)

        const body = new Sprite()
        body.anchor.set(0.5, 0.5)
        turret.addChild(body)

        const towerFill = new Graphics()
        turret.addChild(towerFill)

        ;(container as ContainerWithTarget).__barrelContainer = turret
        ;(container as ContainerWithTarget).__towerFillGraphics = towerFill
        ;(container as ContainerWithTarget).__towerEnergy = towerEnergy
        ;(container as ContainerWithTarget).__towerCapacity = towerCap

        // Scale both layers by the body's authored size so they stay aligned, and
        // map the fill geometry (atlas px) into the same render-scaled space.
        const applyScale = (tex: Texture) => {
          const ref = tex.orig?.width || tex.width
          const s = ref > 0 ? targetSize / ref : 1
          ring.scale.set(s)
          body.scale.set(s)
          ;(container as ContainerWithTarget).__towerFillRect = {
            x: towerSpec.fill.x * s,
            yMin: towerSpec.fill.yMin * s,
            width: towerSpec.fill.width * s,
            heightMax: towerSpec.fill.heightMax * s,
            rx: towerSpec.fill.rx * s,
            ry: towerSpec.fill.ry * s,
          }
          updateTowerFill(container as ContainerWithTarget, calcTowerFillHeight(towerEnergy, towerCap))
        }

        const ringTex = atlasCache.getTexture(theme!.atlasUrl, towerSpec.ringFrame)
        const bodyTex = atlasCache.getTexture(theme!.atlasUrl, towerSpec.bodyFrame)
        if (ringTex && bodyTex) {
          ring.texture = ringTex
          body.texture = bodyTex
          applyScale(bodyTex)
        } else {
          atlasCache.getOrLoad(theme!.atlasUrl).then(sheet => {
            if (!ring.destroyed) ring.texture = sheet.textures[towerSpec.ringFrame] ?? Texture.EMPTY
            if (!body.destroyed) {
              const t = sheet.textures[towerSpec.bodyFrame] ?? Texture.EMPTY
              body.texture = t
              if (!container.destroyed) applyScale(t)
            }
          }).catch(() => {})
        }
        break
      }

      // Static outer circle
      const towerBase = new Graphics()
      towerBase.circle(cx, cy, TILE_SIZE * 0.6)
      towerBase.fill(ST_DARK)
      towerBase.circle(cx, cy, TILE_SIZE * 0.6)
      towerBase.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      container.addChild(towerBase)

      // Rotating turret: body rect + energy fill + barrel — pivot at tile center
      const turret = new Container()
      turret.position.set(cx, cy)

      const towerBody = new Graphics()
      towerBody.rect(TOWER_BODY_X, TOWER_BODY_Y, TOWER_BODY_W, TOWER_BODY_H)
      towerBody.fill(ST_DARK)
      turret.addChild(towerBody)

      const towerFill = new Graphics()
      turret.addChild(towerFill)
      ;(container as ContainerWithTarget).__towerFillGraphics = towerFill as unknown as Graphics
      ;(container as ContainerWithTarget).__towerEnergy = towerEnergy
      ;(container as ContainerWithTarget).__towerCapacity = towerCap
      updateTowerFill(container as ContainerWithTarget, calcTowerFillHeight(towerEnergy, towerCap))

      const towerBorder = new Graphics()
      towerBorder.rect(TOWER_BODY_X, TOWER_BODY_Y, TOWER_BODY_W, TOWER_BODY_H)
      towerBorder.stroke({ width: 1, color: ST_GRAY })
      turret.addChild(towerBorder)

      const barrelG = new Graphics()
      barrelG.rect(-TILE_SIZE * 0.2, -TILE_SIZE * 0.9, TILE_SIZE * 0.4, TILE_SIZE * 0.5)
      barrelG.fill(ST_LIGHT)
      barrelG.rect(-TILE_SIZE * 0.2, -TILE_SIZE * 0.9, TILE_SIZE * 0.4, TILE_SIZE * 0.5)
      barrelG.stroke({ width: TILE_SIZE * 0.07, color: ST_DARK })
      turret.addChild(barrelG)

      container.addChild(turret)
      ;(container as ContainerWithTarget).__barrelContainer = turret
      break
    }
    case 'storage': {
      const spec = theme?.sprites['storage']
      if (spec && atlasCache) {
        const { bands: storageBands, used: storageUsed, capacity: storageCap } = getStoreBands(obj)
        const targetSize = TILE_SIZE * spec.tileScale
        const applyTexture = (sprite: Sprite, tex: Texture) => {
          sprite.texture = tex
          sprite.width = targetSize
          sprite.height = targetSize
        }
        for (const layer of spec.layers) {
          const sprite = new Sprite()
          sprite.anchor.set(0.5, 0.5)
          sprite.x = cx
          sprite.y = cy
          if (layer.tint === 'owner') sprite.tint = outlineColor
          container.addChild(sprite)
          const tex = atlasCache.getTexture(theme!.atlasUrl, layer.frame)
          if (tex) {
            applyTexture(sprite, tex)
          } else {
            atlasCache.getOrLoad(theme!.atlasUrl).then(sheet => {
              if (!sprite.destroyed) applyTexture(sprite, sheet.textures[layer.frame] ?? Texture.EMPTY)
            }).catch(() => {})
          }
        }
        const storageFillG = new Graphics()
        container.addChild(storageFillG)
        ;(container as ContainerWithTarget).__storageFillG = storageFillG
        ;(container as ContainerWithTarget).__storageBands = storageBands
        ;(container as ContainerWithTarget).__storageUsed = storageUsed
        ;(container as ContainerWithTarget).__storageCapacity = storageCap
        updateStorageFill(container as ContainerWithTarget, calcStorageFillHeight(storageUsed, storageCap))
        break
      }
      const { bands: storageBands, used: storageUsed, capacity: storageCap } = getStoreBands(obj)
      const storagePts = spts(cx, cy, [
        [-0.6, -0.7], [0, -0.8], [0.6, -0.7], [0.65, 0],
        [0.6, 0.7], [0, 0.8], [-0.6, 0.7], [-0.65, 0], [-0.6, -0.7],
      ])
      g.poly(storagePts)
      g.fill(ST_DARK)
      g.poly(storagePts)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.rect(cx - TILE_SIZE * 0.5, cy - TILE_SIZE * 0.6, TILE_SIZE * 1.0, TILE_SIZE * 1.2)
      g.fill(ST_GRAY)
      container.addChild(g)

      const storageFillG = new Graphics()
      container.addChild(storageFillG)
      ;(container as ContainerWithTarget).__storageFillG = storageFillG
      ;(container as ContainerWithTarget).__storageBands = storageBands
      ;(container as ContainerWithTarget).__storageUsed = storageUsed
      ;(container as ContainerWithTarget).__storageCapacity = storageCap
      updateStorageFill(container as ContainerWithTarget, calcStorageFillHeight(storageUsed, storageCap))

      const storageBorderG = new Graphics()
      storageBorderG.rect(cx - TILE_SIZE * 0.5, cy - TILE_SIZE * 0.6, TILE_SIZE * 1.0, TILE_SIZE * 1.2)
      storageBorderG.stroke({ width: TILE_SIZE * 0.1, color: ST_DARK })
      container.addChild(storageBorderG)
      break
    }
    case 'terminal': {
      const termOuter = spts(cx, cy, [
        [0, -0.8], [0.55, -0.55], [0.8, 0], [0.55, 0.55],
        [0, 0.8], [-0.55, 0.55], [-0.8, 0], [-0.55, -0.55], [0, -0.8],
      ])
      const termInner = spts(cx, cy, [
        [0, -0.65], [0.45, -0.45], [0.65, 0], [0.45, 0.45],
        [0, 0.65], [-0.45, 0.45], [-0.65, 0], [-0.45, -0.45], [0, -0.65],
      ])
      g.poly(termOuter)
      g.fill(ST_DARK)
      g.poly(termOuter)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.poly(termInner)
      g.fill(ST_LIGHT)
      g.rect(cx - TILE_SIZE * 0.45, cy - TILE_SIZE * 0.45, TILE_SIZE * 0.9, TILE_SIZE * 0.9)
      g.fill(ST_GRAY)
      g.rect(cx - TILE_SIZE * 0.45, cy - TILE_SIZE * 0.45, TILE_SIZE * 0.9, TILE_SIZE * 0.9)
      g.stroke({ width: TILE_SIZE * 0.1, color: ST_DARK })
      container.addChild(g)

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
      break
    }
    case 'link': {
      const linkOuter = spts(cx, cy, [[0, -0.5], [0.4, 0], [0, 0.5], [-0.4, 0], [0, -0.5]])
      const linkInner = spts(cx, cy, [[0, -0.3], [0.25, 0], [0, 0.3], [-0.25, 0], [0, -0.3]])
      g.poly(linkOuter)
      g.fill(ST_DARK)
      g.poly(linkOuter)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.poly(linkInner)
      g.fill(ST_GRAY)
      container.addChild(g)

      // Energy core: a diamond that scales with stored energy, animated each tick
      // via the shared fill-tween loop (see startLinkAnimation / updateLinkFill).
      const { energy: linkEnergy, capacity: linkCapacity } = getExtensionEnergy(obj)
      const linkFill = new Graphics()
      container.addChild(linkFill)
      const linkVisual = container as ContainerWithTarget
      linkVisual.__linkFillGraphics = linkFill
      linkVisual.__linkEnergy = linkEnergy
      linkVisual.__linkCapacity = linkCapacity
      updateLinkFill(linkVisual, calcLinkFillFraction(linkEnergy, linkCapacity))
      break
    }
    case 'lab': {
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
      break
    }
    case 'container': {
      const { bands: contBands, used: contUsed, capacity: contCap } = getStoreBands(obj)
      g.rect(CONT_X, CONT_Y, CONT_W, CONT_H)
      g.fill(ST_DARK)
      // Grey interior backdrop (like storage) — shows above the fill; the dark box frames it.
      g.rect(CONT_X + CONT_MARGIN, CONT_Y + CONT_MARGIN, CONT_W - CONT_MARGIN * 2, CONT_H - CONT_MARGIN * 2)
      g.fill(ST_GRAY)
      container.addChild(g)

      const contFillG = new Graphics()
      container.addChild(contFillG)
      ;(container as ContainerWithTarget).__containerFillG = contFillG
      ;(container as ContainerWithTarget).__containerBands = contBands
      ;(container as ContainerWithTarget).__containerUsed = contUsed
      ;(container as ContainerWithTarget).__containerCapacity = contCap
      updateContainerFill(container as ContainerWithTarget, calcContainerFillHeight(contUsed, contCap))

      const contBorderG = new Graphics()
      contBorderG.rect(CONT_X, CONT_Y, CONT_W, CONT_H)
      contBorderG.stroke({ width: TILE_SIZE * 0.1, color: ST_DARK })
      container.addChild(contBorderG)
      break
    }
    case 'observer': {
      g.circle(cx, cy, TILE_SIZE * 0.45)
      g.fill(ST_DARK)
      g.circle(cx, cy, TILE_SIZE * 0.45)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.circle(cx + TILE_SIZE * 0.225, cy, TILE_SIZE * 0.2)
      g.fill(outlineColor)
      break
    }
    case 'nuker': {
      const nukerOuter = spts(cx, cy, [
        [0, -1], [-0.47, 0.2], [-0.5, 0.5], [0.5, 0.5], [0.47, 0.2], [0, -1],
      ])
      const nukerInner = spts(cx, cy, [
        [0, -0.8], [-0.4, 0.2], [0.4, 0.2], [0, -0.8],
      ])
      g.poly(nukerOuter)
      g.fill(ST_DARK)
      g.poly(nukerOuter)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.poly(nukerInner)
      g.fill(ST_GRAY)
      g.poly(nukerInner)
      g.stroke({ width: TILE_SIZE * 0.01, color: outlineColor })
      container.addChild(g)

      // Energy fills the inner triangle bottom→top; ghodium fills the base bar.
      const { energy: nukeEnergy, energyCap: nukeECap, ghodium, ghodiumCap } = getNukerContents(obj)
      const nukerEnergyG = new Graphics()
      container.addChild(nukerEnergyG)
      const nukerGhodiumG = new Graphics()
      container.addChild(nukerGhodiumG)
      const nukerVisual = container as ContainerWithTarget
      nukerVisual.__nukerEnergyG = nukerEnergyG
      nukerVisual.__nukerGhodiumG = nukerGhodiumG
      nukerVisual.__nukerEnergy = nukeEnergy
      nukerVisual.__nukerEnergyCap = nukeECap
      nukerVisual.__nukerGhodium = ghodium
      nukerVisual.__nukerGhodiumCap = ghodiumCap
      updateNukerFill(nukerVisual, calcCenterFillFraction(nukeEnergy, nukeECap), calcCenterFillFraction(ghodium, ghodiumCap))
      break
    }
    case 'factory': {
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
      factVisual.__factoryActive = factoryActive(obj)
      factVisual.__factoryGlowColor = outlineColor
      updateFactoryFill(factVisual, calcFactoryFillHeight(factUsed, factCap))
      break
    }
    case 'extractor': {
      // Continuously rotating ring (rendered above the mineral) — three gapped arc
      // segments drawn procedurally (one extractor per room, so no atlas needed).
      // Tinted tri-state by room ownership: owner green when ours, hostile red when
      // foreign-owned, neutral grey when the room is unowned (extractor has no owner).
      const ring = new Graphics()
      ring.position.set(cx, cy)
      drawExtractorRing(ring, ownedByUser === undefined ? OBJ_GREY : outlineColor)
      container.addChild(ring)
      ;(container as ContainerWithTarget).__extractorRing = ring
      break
    }
    case 'invaderCore': {
      g.circle(cx, cy, TILE_SIZE * 0.45)
      g.fill(ST_DARK)
      g.circle(cx, cy, TILE_SIZE * 0.45)
      g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
      g.circle(cx, cy, TILE_SIZE * 0.35)
      g.fill(ST_GRAY)
      break
    }
    case 'flag': {
      const colorIdx = typeof obj.color === 'number' ? obj.color : 0
      const secColorIdx = typeof obj.secondaryColor === 'number' ? obj.secondaryColor : 0
      const flagColor = FLAG_COLORS[colorIdx] ?? FLAG_COLORS[0]
      const secColor = FLAG_COLORS[secColorIdx] ?? FLAG_COLORS[0]

      const flagSpec: FlagSpec | undefined = theme?.flag
      if (flagSpec && atlasCache) {
        const targetSize = TILE_SIZE * flagSpec.tileScale
        const loadAtlas = (): Promise<import('pixi.js').Spritesheet> => atlasCache.getOrLoad(theme!.atlasUrl)
        const applyTex = (sprite: Sprite, tex: Texture) => {
          sprite.texture = tex
          sprite.width = targetSize
          sprite.height = targetSize
        }

        const mainSprite = new Sprite()
        mainSprite.anchor.set(0.5, 0.5)
        mainSprite.x = cx
        mainSprite.y = cy
        mainSprite.tint = flagColor
        container.addChild(mainSprite)

        const mainTex = atlasCache.getTexture(theme!.atlasUrl, flagSpec.mainFrame)
        if (mainTex) {
          applyTex(mainSprite, mainTex)
        } else {
          loadAtlas().then(sheet => {
            if (!mainSprite.destroyed) applyTex(mainSprite, sheet.textures[flagSpec.mainFrame] ?? Texture.EMPTY)
          }).catch(() => {})
        }

        if (secColorIdx !== colorIdx) {
          const secondSprite = new Sprite()
          secondSprite.anchor.set(0.5, 0.5)
          secondSprite.x = cx
          secondSprite.y = cy
          secondSprite.tint = secColor
          container.addChild(secondSprite)

          const secondTex = atlasCache.getTexture(theme!.atlasUrl, flagSpec.secondFrame)
          if (secondTex) {
            applyTex(secondSprite, secondTex)
          } else {
            loadAtlas().then(sheet => {
              if (!secondSprite.destroyed) applyTex(secondSprite, sheet.textures[flagSpec.secondFrame] ?? Texture.EMPTY)
            }).catch(() => {})
          }
        }
      } else {
        // Graphics fallback
        const S = 1.5
        const poleW = TILE_SIZE * 0.08 * S
        const poleH = TILE_SIZE * 0.7 * S
        const poleX = cx - poleW / 2
        const poleY = cy - TILE_SIZE * 0.25 * S
        g.rect(poleX, poleY, poleW, poleH)
        g.fill(0x888888)

        const attachX = poleX + poleW
        const attachY = poleY
        const tipX = attachX + TILE_SIZE * 0.45 * S
        const topY = attachY
        const bottomY = attachY + TILE_SIZE * 0.44 * S
        const tipY = (topY + bottomY) / 2
        const splitY = tipY

        g.moveTo(attachX, topY)
        g.lineTo(tipX, tipY)
        g.lineTo(attachX, splitY)
        g.closePath()
        g.fill(flagColor)

        g.moveTo(attachX, splitY)
        g.lineTo(tipX, tipY)
        g.lineTo(attachX, bottomY)
        g.closePath()
        g.fill(secColor)

        container.addChild(g)
      }

      ;(container as ContainerWithTarget).__flagColor = colorIdx
      ;(container as ContainerWithTarget).__flagSecondaryColor = secColorIdx

      // Label with flag name
      if (typeof obj.name === 'string') {
        const label = new Text({
          text: obj.name as string,
          style: { fontSize: LABEL_FONT_SIZE, fill: 0xffffff },
        })
        label.scale.set(LABEL_FONT_SCALE)
        label.anchor.set(0.5, 0)
        label.x = cx
        label.y = cy + TILE_SIZE * 0.55
        label.visible = showLabel
        ;(container as ContainerWithTarget).__nameLabel = label
        container.addChild(label)
      }
      break
    }
    case 'ruin': {
      const rUser = typeof obj.user === 'string' ? obj.user : undefined
      const isMine = rUser !== undefined && rUser === currentUserId
      const rColor = isMine ? CS_OWN : OBJ_FOREIGN

      // Broken outer ring — short arc segments with gaps suggest a destroyed structure
      const ringR = TILE_SIZE * 0.42
      const segCount = 6
      const arcLen = Math.PI / 5
      const ringG = new Graphics()
      for (let i = 0; i < segCount; i++) {
        const center = (i * Math.PI * 2) / segCount
        const start = center - arcLen / 2
        const end = center + arcLen / 2
        const sx = cx + ringR * Math.cos(start)
        const sy = cy + ringR * Math.sin(start)
        ringG.moveTo(sx, sy)
        ringG.arc(cx, cy, ringR, start, end)
        ringG.stroke({ width: TILE_SIZE * 0.09, color: rColor, alpha: 0.75, cap: 'round' })
      }
      container.addChild(ringG)

      // Central X — same color
      const xR = TILE_SIZE * 0.18
      const xMark = new Graphics()
      xMark.moveTo(cx - xR, cy - xR)
      xMark.lineTo(cx + xR, cy + xR)
      xMark.moveTo(cx + xR, cy - xR)
      xMark.lineTo(cx - xR, cy + xR)
      xMark.stroke({ width: TILE_SIZE * 0.11, color: rColor, cap: 'round' })
      container.addChild(xMark)
      break
    }
    case 'tombstone': {
      const tsUser = typeof obj.user === 'string' ? obj.user : undefined
      const isMine = tsUser !== undefined && tsUser === currentUserId
      const tsColor = isMine ? CS_OWN : OBJ_FOREIGN

      const tsSpec: TombstoneSpec | undefined = theme?.tombstone
      if (tsSpec && atlasCache) {
        const targetSize = TILE_SIZE * tsSpec.tileScale
        const loadAtlas = (): Promise<import('pixi.js').Spritesheet> => atlasCache.getOrLoad(theme!.atlasUrl)

        const shellSprite = new Sprite()
        shellSprite.anchor.set(0.5, 0.5)
        shellSprite.x = cx
        shellSprite.y = cy
        shellSprite.width = targetSize
        shellSprite.height = targetSize
        container.addChild(shellSprite)

        const crossSprite = new Sprite()
        crossSprite.anchor.set(0.5, 0.5)
        crossSprite.x = cx
        crossSprite.y = cy
        crossSprite.width = targetSize
        crossSprite.height = targetSize
        crossSprite.tint = tsColor
        container.addChild(crossSprite)

        const shellTex = atlasCache.getTexture(theme!.atlasUrl, tsSpec.shellFrame)
        if (shellTex) {
          shellSprite.texture = shellTex
        } else {
          loadAtlas().then(sheet => {
            if (!shellSprite.destroyed) shellSprite.texture = sheet.textures[tsSpec.shellFrame] ?? Texture.EMPTY
          }).catch(() => {})
        }

        const crossTex = atlasCache.getTexture(theme!.atlasUrl, tsSpec.crossFrame)
        if (crossTex) {
          crossSprite.texture = crossTex
        } else {
          loadAtlas().then(sheet => {
            if (!crossSprite.destroyed) crossSprite.texture = sheet.textures[tsSpec.crossFrame] ?? Texture.EMPTY
          }).catch(() => {})
        }
      } else {
        // Graphics fallback
        const w = TILE_SIZE * 0.62
        const h = TILE_SIZE * 0.82
        const x0 = cx - w / 2
        const y0 = cy - h / 2
        const r = w / 2

        const tg = new Graphics()
        tg.moveTo(x0, y0 + r)
        tg.arc(cx, y0 + r, r, Math.PI, 0, false)
        tg.lineTo(x0 + w, y0 + h)
        tg.lineTo(x0, y0 + h)
        tg.closePath()
        tg.fill(ST_DARK)
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
      }
      break
    }
    default: {
      // Structures (fallback)
      const size = TILE_SIZE - 2
      g.rect(1, 1, size, size)
      g.fill(color)
    }
  }

  if (obj.type !== 'extension' && obj.type !== 'road' && obj.type !== 'creep' && obj.type !== 'tower' && obj.type !== 'controller' && obj.type !== 'flag' && obj.type !== 'source' && obj.type !== 'constructionSite' && obj.type !== 'mineral' && obj.type !== 'tombstone' && obj.type !== 'ruin' && obj.type !== 'storage' && obj.type !== 'constructedWall' && obj.type !== 'rampart' && obj.type !== 'container' && obj.type !== 'deposit' && obj.type !== 'link' && obj.type !== 'terminal' && obj.type !== 'lab' && obj.type !== 'nuker' && obj.type !== 'factory') {
    container.addChild(g)
  }

  // Label for creeps — rendered at high font size, scaled down so it stays crisp when zoomed.
  // Base scale gives ~8px height at world-scale=1; ObjectLayer.tick() divides by world-scale
  // so the label stays constant in screen pixels and shrinks relative to the creep when zoomed in.
  if (obj.type === 'creep' && typeof obj.name === 'string') {
    const isForeign = isForeignCreep(obj, currentUserId)
    let labelText: string
    if (isForeign) {
      const userId = typeof obj.user === 'string' ? obj.user : undefined
      labelText = userId ? (users?.[userId]?.username ?? userId) : 'Hostile'
    } else {
      labelText = obj.name as string
    }
    const labelColor = isForeign ? OBJ_FOREIGN : 0xffffff
    const label = new Text({
      text: labelText,
      style: { fontSize: LABEL_FONT_SIZE, fill: labelColor },
    })
    label.scale.set(LABEL_FONT_SCALE)
    label.anchor.set(0.5, 1)
    label.x = cx
    label.y = LABEL_CREEP_TOP - LABEL_GAP_PX  // correct at world-scale=1; ticker adjusts on zoom
    label.visible = showLabel
    ;(container as ContainerWithTarget).__nameLabel = label
    container.addChild(label)
  }

  // Tier-based zIndex: structures=0, creeps=100, flags=200
  // Each spec can add an offset within its tier via zIndex field
  const baseZ = obj.type === 'creep' ? 100 : obj.type === 'flag' ? 200 : 0
  const specZ = obj.type === 'flag' ? (theme?.flag?.zIndex ?? 0)
    : obj.type === 'controller' ? (theme?.controller?.zIndex ?? 0)
    : obj.type === 'tombstone' ? (theme?.tombstone?.zIndex ?? 0)
    : obj.type === 'mineral' ? (theme?.mineral?.zIndex ?? 0)
    : obj.type === 'extractor' ? EXTRACTOR_Z_INDEX
    : (theme?.sprites[obj.type]?.zIndex ?? 0)
  container.zIndex = baseZ + specZ

  container.position.set(obj.x * TILE_SIZE, obj.y * TILE_SIZE)
  return container
}

type ContainerWithTarget = Container & {
  __targetX?: number
  __targetY?: number
  __moveStartX?: number
  __moveStartY?: number
  __moveStartT?: number
  __moveDur?: number
  __tileX?: number
  __tileY?: number
  __angle?: number
  __bodyContainer?: Container
  __sayBubble?: Container
  __sayMessage?: string
  __creepFillGraphics?: Graphics
  __creepUsed?: number
  __creepCapacity?: number
  __nameLabel?: Text
  __creepBorderG?: Graphics
  __creepBadgeSprite?: Sprite
  __creepForeignMark?: Graphics
  __towerFillGraphics?: Graphics
  __towerEnergy?: number
  __towerCapacity?: number
  __towerFillRect?: { x: number; yMin: number; width: number; heightMax: number; rx: number; ry: number }
  __linkFillGraphics?: Graphics
  __linkEnergy?: number
  __linkCapacity?: number
  __storageFillG?: Graphics
  __storageBands?: StoreBand[]
  __storageUsed?: number
  __storageCapacity?: number
  __containerFillG?: Graphics
  __containerBands?: StoreBand[]
  __containerUsed?: number
  __containerCapacity?: number
  __terminalFillG?: Graphics
  __terminalFillColor?: number
  __terminalDominant?: string
  __terminalUsed?: number
  __terminalCapacity?: number
  __labMineralG?: Graphics
  __labEnergyG?: Graphics
  __labMineralColor?: number
  __labMineralType?: string
  __labEnergy?: number
  __labEnergyCap?: number
  __labMineral?: number
  __labMineralCap?: number
  __nukerEnergyG?: Graphics
  __nukerGhodiumG?: Graphics
  __nukerEnergy?: number
  __nukerEnergyCap?: number
  __nukerGhodium?: number
  __nukerGhodiumCap?: number
  __factoryGearG?: Graphics
  __factoryRingG?: Graphics
  __factoryFillG?: Graphics
  __factoryBands?: StoreBand[]
  __factoryUsed?: number
  __factoryCapacity?: number
  __factoryLevel?: number
  __factoryActive?: boolean
  __factoryGlowColor?: number
  __barrelContainer?: Container
  __towerAimAngle?: number   // target rotation while an action is active
  __towerAimUntil?: number   // performance.now() timestamp when the aim hold ends
  __towerIdlePhase?: number  // phase offset so idle sweep resumes seamlessly after aiming
  __extractorRing?: Container  // continuously rotating mineral-extractor ring
  __ctrlSegGraphics?: Graphics
  __ctrlSegSprites?: Sprite[]
  __ctrlLevel?: number
  __ctrlProgress?: number
  __ctrlProgressTotal?: number
  __ctrlDowngradeTime?: number
  __ctrlUserId?: string
  __flagColor?: number
  __flagSecondaryColor?: number
  __sourceGraphics?: Graphics
  __sourceEnergy?: number
  __sourceCapacity?: number
  __sourceSize?: number
  __csBuildGlow?: Graphics
  __csFillGraphics?: Graphics
  __csRingGraphics?: Graphics
  __csProgress?: number
  __csProgressTotal?: number
  __csUser?: string
  __csColor?: number
  __csColorDark?: number
  __csColorLight?: number
  __spawnRing?: Graphics
  __spawnRatio?: number | null
  __spawnNeedTime?: number
  __spawnEndTime?: number
  __spawnSig?: string | null
}

function destroyVisual(visual: ContainerWithTarget): void {
  visual.destroy({ children: true })
}

function buildSayBubble(message: string): Container {
  const trimmed = message.length > SAY_MAX_CHARS ? message.slice(0, SAY_MAX_CHARS) : message

  const text = new Text({
    text: trimmed,
    style: { fontSize: LABEL_FONT_SIZE, fill: SAY_TX_COLOR, fontWeight: '600' },
  })
  text.scale.set(SAY_FONT_SCALE)
  text.anchor.set(0.5, 0.5)

  // text.width / text.height are post-scale (i.e. in world units after LABEL_FONT_SCALE)
  const tw = text.width
  const th = text.height
  const bw = tw + SAY_PAD_X * 2
  const bh = th + SAY_PAD_Y * 2
  const r  = bh / 2

  const bg = new Graphics()
  bg.roundRect(-bw / 2, -bh / 2, bw, bh, r)
  bg.fill(SAY_BG_COLOR)
  bg.roundRect(-bw / 2, -bh / 2, bw, bh, r)
  bg.stroke({ width: 0.4, color: 0x111111, alpha: 0.55 })

  // Tail pointing down — filled, then stroked along the two outer edges so the
  // pill's lower border still reads cleanly across the join.
  bg.moveTo(-SAY_TAIL_W, bh / 2 - 0.1)
  bg.lineTo(0, bh / 2 + SAY_TAIL_H)
  bg.lineTo(SAY_TAIL_W, bh / 2 - 0.1)
  bg.closePath()
  bg.fill(SAY_BG_COLOR)
  bg.moveTo(-SAY_TAIL_W, bh / 2 - 0.1)
  bg.lineTo(0, bh / 2 + SAY_TAIL_H)
  bg.lineTo(SAY_TAIL_W, bh / 2 - 0.1)
  bg.stroke({ width: 0.4, color: 0x111111, alpha: 0.55 })

  const bubble = new Container()
  bubble.addChild(bg)
  bubble.addChild(text)
  // Pivot at tail tip so positioning aligns the tail tip to the desired coordinate.
  bubble.pivot.set(0, bh / 2 + SAY_TAIL_H)
  return bubble
}

// One generic fill tween. Channel `a` (and optional `b`, for two-channel fills like lab
// energy+mineral or nuker energy+ghodium) eases from→to over EXT_ANIM_DURATION, then `apply`
// repaints the visual. Single-channel fills leave `b` at 0; their `apply` ignores it.
interface FillAnimation {
  visual: ContainerWithTarget
  fromA: number
  toA: number
  fromB: number
  toB: number
  apply: (visual: ContainerWithTarget, a: number, b: number) => void
  startTime: number
}

export interface ObjectEntry {
  id: string
  obj: RoomObject
  visual: ContainerWithTarget
}

export class ObjectLayer {
  readonly container: Container
  private objects = new Map<string, ContainerWithTarget>()
  private rawObjects = new Map<string, RoomObject>()
  private roadGraphics: Graphics
  private rampartGraphics: Graphics
  private rampartGlowGraphics: Graphics
  private wallGraphics: Graphics
  private wallMarkGraphics: Graphics
  private ticker: Ticker | null = null
  private tickerCallback: (() => void) | null = null
  // One map for every fill tween (extension/creep/tower/storage/container/terminal/factory/
  // lab/nuker/link/source). An object has a single type, so its id maps to at most one entry.
  private fillAnimations = new Map<string, FillAnimation>()
  private buildGlowAnimations = new Map<string, { startTime: number; duration: number }>()
  private ctrlFlashAnimations = new Map<string, { segIndex: number; startTime: number; duration: number }>()
  private currentGameTime = 0
  private sayBubbles = new Set<string>()
  private moveDuration = 600
  private readonly EXT_ANIM_DURATION = 300
  private instantMode = false
  private lastWorldScale = 1
  private showLabels: boolean
  private currentUserId?: string
  private badge?: Badge
  private readonly badgeCache = sharedBadgeCache
  private users?: Record<string, { _id: string; username: string; badge?: Badge }>
  private activeTheme: Theme | null = null
  private atlasCache: AtlasCache | null = null
  private roadColor: number = OBJ_ROAD
  private lighting: LightingLayer | null = null

  constructor(ticker?: Ticker, showLabels = true, currentUserId?: string, badge?: Badge, users?: Record<string, { _id: string; username: string; badge?: Badge }>) {
    this.showLabels = showLabels
    this.currentUserId = currentUserId
    this.badge = badge
    this.users = users
    this.container = new Container()
    this.container.sortableChildren = true
    this.wallGraphics = new Graphics()
    this.wallGraphics.zIndex = -3
    this.container.addChild(this.wallGraphics)
    this.wallMarkGraphics = new Graphics()
    this.wallMarkGraphics.zIndex = -2
    this.container.addChild(this.wallMarkGraphics)
    this.rampartGraphics = new Graphics()
    // Ramparts overlay everything in the tile as a translucent green wash (vanilla):
    // above structures (zIndex 0) AND creeps (100) — a creep standing on a rampart
    // shows under the green — but below flags (200).
    this.rampartGraphics.zIndex = 150
    this.container.addChild(this.rampartGraphics)
    // Soft rim glow, blurred via the same BlurFilter pattern the swamp glow uses
    // (TerrainLayer.createSwampGlow). Sits just below the fill layer so its halo
    // reads past the blob edge and tints up through the translucent fill, while the
    // crisp rim draws on top.
    this.rampartGlowGraphics = new Graphics()
    this.rampartGlowGraphics.zIndex = 149
    this.rampartGlowGraphics.filters = [new BlurFilter({ strength: 3, quality: 3 })]
    this.container.addChild(this.rampartGlowGraphics)
    this.roadGraphics = new Graphics()
    this.container.addChild(this.roadGraphics)
    if (ticker) {
      this.ticker = ticker
      this.tickerCallback = () => this.tick()
      ticker.add(this.tickerCallback)
    }
  }

  setTheme(theme: Theme | null, cache: AtlasCache | null): void {
    this.activeTheme = theme
    this.atlasCache = cache
  }

  setRoadColor(color: number): void {
    this.roadColor = color
    this.redrawRoads()
  }

  // The dark-overlay lightmap. ObjectLayer drives per-frame light positions so a
  // creep's light pool follows its interpolated motion instead of snapping at
  // tick end (the set of lights is reconciled per tick from RoomRenderer).
  setLightingLayer(lighting: LightingLayer | null): void {
    this.lighting = lighting
  }

  private tick(): void {
    const tNow = performance.now()

    // Creep movement interpolation — linear over ~90% of the current tick duration
    // (driven from RoomViewer via setMoveDuration()). The light pool is nudged to
    // match each frame so it tracks the sprite instead of snapping at tick end.
    const lighting = this.lighting
    for (const [id, visual] of this.objects) {
      if (visual.__targetX === undefined || visual.__targetY === undefined) continue
      const dur = visual.__moveDur ?? 0
      const startT = visual.__moveStartT ?? tNow
      const elapsed = tNow - startT
      if (dur <= 0 || elapsed >= dur) {
        visual.position.set(visual.__targetX, visual.__targetY)
        visual.__targetX = undefined
        visual.__targetY = undefined
        visual.__moveStartX = undefined
        visual.__moveStartY = undefined
        visual.__moveStartT = undefined
        visual.__moveDur = undefined
        lighting?.setLightPosition(id, visual.x + TILE_SIZE / 2, visual.y + TILE_SIZE / 2)
        continue
      }
      const t = elapsed / dur
      const sx = visual.__moveStartX ?? visual.x
      const sy = visual.__moveStartY ?? visual.y
      visual.x = sx + (visual.__targetX - sx) * t
      visual.y = sy + (visual.__targetY - sy) * t
      lighting?.setLightPosition(id, visual.x + TILE_SIZE / 2, visual.y + TILE_SIZE / 2)
    }

    // Say bubbles intentionally have no timer-based expiry — their lifecycle is
    // driven entirely by the room:update tick signal (triggerSay + pruneSayBubblesExcept).

    // Label scale: invert world zoom so labels stay at constant screen size.
    // Relative to the (now larger) creep this makes them appear smaller on zoom-in.
    const worldScale = this.container.parent?.scale.x ?? 1
    if (worldScale !== this.lastWorldScale) {
      this.lastWorldScale = worldScale
      for (const visual of this.objects.values()) {
        this.applyLabelScale(visual)
      }
    }

    // Time-based animations (independent of game tick)
    const now = performance.now()
    const t_sec = now / 1000

    // Tower barrel rotation + construction-site ring pulsation
    const pulse = 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / CS_PULSE_MS)
    for (const visual of this.objects.values()) {
      if (visual.__barrelContainer) {
        const turret = visual.__barrelContainer
        if (visual.__towerAimUntil !== undefined && now < visual.__towerAimUntil && visual.__towerAimAngle !== undefined) {
          // Firing / repairing: turn quickly toward the target and hold there.
          turret.rotation = approachAngle(turret.rotation, visual.__towerAimAngle, TOWER_AIM_LERP)
        } else {
          if (visual.__towerAimUntil !== undefined) {
            // Action finished — rebase the idle phase so the sweep resumes from
            // the current angle instead of snapping back to the global sweep.
            visual.__towerIdlePhase = turret.rotation - t_sec * TOWER_IDLE_SPEED
            visual.__towerAimUntil = undefined
            visual.__towerAimAngle = undefined
          }
          turret.rotation = t_sec * TOWER_IDLE_SPEED + (visual.__towerIdlePhase ?? 0)
        }
      }
      if (visual.__extractorRing) {
        visual.__extractorRing.rotation = t_sec * EXTRACTOR_RING_SPEED
      }
      if (visual.__csRingGraphics && visual.__csColorDark !== undefined && visual.__csColorLight !== undefined) {
        drawCSRing(visual.__csRingGraphics, lerpColor(visual.__csColorDark, visual.__csColorLight, pulse))
      }
      // Factory outline pulses brighter while producing (cooldown active).
      if (visual.__factoryGearG && visual.__factoryActive) {
        drawFactoryGear(visual.__factoryGearG, lerpColor(visual.__factoryGlowColor ?? ST_OUTLINE, FACT_GLOW, 0.5 * pulse))
      }
    }

    // Fill tweens (extension/creep/tower/storage/container/terminal/factory/lab/nuker/link/source)
    for (const [id, anim] of this.fillAnimations) {
      const t = Math.min(1, (now - anim.startTime) / this.EXT_ANIM_DURATION)
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      anim.apply(anim.visual, anim.fromA + (anim.toA - anim.fromA) * ease, anim.fromB + (anim.toB - anim.fromB) * ease)
      if (t >= 1) this.fillAnimations.delete(id)
    }

    // Source pulse: every tick repaint each source so the golden core (or the dark
    // ring, when exhausted) breathes. Size animation wrote __sourceSize when active.
    for (const visual of this.objects.values()) {
      const g = visual.__sourceGraphics
      if (!g) continue
      drawSourceVisual(g, visual.__sourceSize ?? SRC_MAX_SIZE, now)
    }

    // Construction-site build glow: fade in during beam build phase, hold, fade out
    for (const [id, anim] of this.buildGlowAnimations) {
      const visual = this.objects.get(id)
      const glow = visual?.__csBuildGlow
      if (!visual || !glow) {
        this.buildGlowAnimations.delete(id)
        continue
      }
      const t = (now - anim.startTime) / anim.duration
      let alpha: number
      if (t <= 0)      alpha = 0
      else if (t < 0.5) alpha = t / 0.5
      else if (t < 0.7) alpha = 1
      else if (t < 1)   alpha = 1 - (t - 0.7) / 0.3
      else              alpha = 0

      glow.clear()
      if (alpha > 0) {
        glow.circle(TILE_SIZE / 2, TILE_SIZE / 2, CS_GLOW_R)
        glow.fill({ color: ST_ENERGY, alpha: alpha * 0.75 })
      }
      if (t >= 1) this.buildGlowAnimations.delete(id)
    }

    // Controller segment flash: the next (not-yet-earned) segment briefly lights up
    // when progress increases, then fades back to its dim base alpha (0.15).
    for (const [id, anim] of this.ctrlFlashAnimations) {
      const visual = this.objects.get(id)
      const segs = visual?.__ctrlSegSprites
      if (!visual || !segs) {
        this.ctrlFlashAnimations.delete(id)
        continue
      }
      const t = Math.min(1, (now - anim.startTime) / anim.duration)
      const ease = 1 - (1 - t) * (1 - t)  // ease-out: peaks immediately, fades back
      const seg = segs[anim.segIndex]
      if (seg && !seg.destroyed) {
        seg.alpha = 1.0 - (1.0 - 0.15) * ease
      }
      if (t >= 1) {
        if (seg && !seg.destroyed) seg.alpha = 0.15
        this.ctrlFlashAnimations.delete(id)
      }
    }

    // Controller downgrade warning: earned segments (0..level-1) tint pink→red as downgrade approaches
    for (const visual of this.objects.values()) {
      const level = visual.__ctrlLevel
      const segs = visual.__ctrlSegSprites
      if (!level || !segs) continue

      const dt = visual.__ctrlDowngradeTime
      if (!dt) {
        for (let i = 0; i < level; i++) {
          const seg = segs[i]
          if (seg && !seg.destroyed) seg.tint = 0xffffff
        }
        continue
      }

      const maxTicks = CONTROLLER_DOWNGRADE[level] ?? 20000
      const remaining = Math.max(0, dt - this.currentGameTime)
      const urgency = 1 - remaining / maxTicks

      if (urgency <= 0.2) {
        for (let i = 0; i < level; i++) {
          const seg = segs[i]
          if (seg && !seg.destroyed) seg.tint = 0xffffff
        }
        continue
      }

      const danger = (urgency - 0.2) / 0.8
      const pulseHz = 0.3 + danger * 1.5
      const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * pulseHz * now / 1000)
      const peakColor = lerpColor(0xffdddd, 0xff2222, danger)
      const tintColor = lerpColor(0xffffff, peakColor, danger * pulse)

      for (let i = 0; i < level; i++) {
        const seg = segs[i]
        if (seg && !seg.destroyed) seg.tint = tintColor
      }
    }

    // Composite the lightmap once per frame (no-op unless a light moved this
    // frame). Runs after interpolation so the texture is up to date before the
    // main frame is presented.
    this.lighting?.render()
  }

  // Centralised fill-tween launcher. Instant-mode snaps straight to the target; an
  // unchanged target is a no-op; otherwise the tween runs and `apply` repaints each frame.
  // `apply` is the per-structure repaint (single-channel repaints ignore the `b` value).
  private startFill(
    id: string,
    visual: ContainerWithTarget,
    apply: (visual: ContainerWithTarget, a: number, b: number) => void,
    fromA: number, toA: number, fromB = 0, toB = 0,
  ): void {
    if (this.instantMode) { apply(visual, toA, toB); return }
    if (fromA === toA && fromB === toB) return
    this.fillAnimations.set(id, { visual, fromA, toA, fromB, toB, apply, startTime: performance.now() })
  }

  private startExtAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateExtensionFill,
      calcExtensionFillRadius(fromEnergy, fromCapacity), calcExtensionFillRadius(toEnergy, toCapacity))
  }

  private startLinkAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateLinkFill,
      calcLinkFillFraction(fromEnergy, fromCapacity), calcLinkFillFraction(toEnergy, toCapacity))
  }

  private startCreepFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateCreepFill,
      calcCreepFillRadius(fromUsed, fromCapacity), calcCreepFillRadius(toUsed, toCapacity))
  }

  private startTowerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateTowerFill,
      calcTowerFillHeight(fromEnergy, fromCapacity), calcTowerFillHeight(toEnergy, toCapacity))
  }

  private startStorageFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateStorageFill,
      calcStorageFillHeight(fromUsed, fromCapacity), calcStorageFillHeight(toUsed, toCapacity))
  }

  private startContainerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateContainerFill,
      calcContainerFillHeight(fromUsed, fromCapacity), calcContainerFillHeight(toUsed, toCapacity))
  }

  private startTerminalFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateTerminalFill,
      calcCenterFillFraction(fromUsed, fromCapacity), calcCenterFillFraction(toUsed, toCapacity))
  }

  private startFactoryFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateFactoryFill,
      calcFactoryFillHeight(fromUsed, fromCapacity), calcFactoryFillHeight(toUsed, toCapacity))
  }

  private startLabFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromE: number, fromECap: number, fromM: number, fromMCap: number,
    toE: number, toECap: number, toM: number, toMCap: number,
  ): void {
    this.startFill(id, visual, updateLabFill,
      calcCenterFillFraction(fromE, fromECap), calcCenterFillFraction(toE, toECap),
      calcCenterFillFraction(fromM, fromMCap), calcCenterFillFraction(toM, toMCap))
  }

  private startNukerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromE: number, fromECap: number, fromG: number, fromGCap: number,
    toE: number, toECap: number, toG: number, toGCap: number,
  ): void {
    this.startFill(id, visual, updateNukerFill,
      calcCenterFillFraction(fromE, fromECap), calcCenterFillFraction(toE, toECap),
      calcCenterFillFraction(fromG, fromGCap), calcCenterFillFraction(toG, toGCap))
  }

  private startSourceAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateSourceVisual,
      calcSourceSize(fromEnergy, fromCapacity), calcSourceSize(toEnergy, toCapacity))
  }

  update(objects: RoomObjectMap, diff?: RoomObjectDiff, users?: Record<string, { _id: string; username: string; badge?: Badge }>, gameTime?: number): void {
    if (users) {
      this.users = users
    }
    if (gameTime !== undefined) {
      this.currentGameTime = gameTime
    }
    let roadsChanged = false
    let wallsChanged = false
    let rampartsChanged = false

    if (diff) {
      // Use for...in over Object.entries to avoid array allocation per tick
      for (const id in diff) {
        const changes = diff[id]
        if (changes === null) {
          const oldObj = this.rawObjects.get(id)
          if (oldObj && oldObj.type === 'road') roadsChanged = true
          if (oldObj && oldObj.type === 'constructedWall') wallsChanged = true
          if (oldObj && oldObj.type === 'rampart') rampartsChanged = true

          const visual = this.objects.get(id)
          if (visual) {
            this.container.removeChild(visual)
            destroyVisual(visual)
            this.objects.delete(id)
            this.rawObjects.delete(id)
            this.fillAnimations.delete(id)
            this.buildGlowAnimations.delete(id)
            this.ctrlFlashAnimations.delete(id)
            this.sayBubbles.delete(id)
          }
        } else {
          const obj = objects[id]
          if (!obj) continue
          
          if (obj.type === 'road') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y) {
              roadsChanged = true
            }
          } else if (obj.type === 'constructedWall') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y) {
              wallsChanged = true
            }
          } else if (obj.type === 'rampart') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y || existing.user !== obj.user) {
              rampartsChanged = true
            }
          }

          this.rawObjects.set(id, obj)
          const existing = this.objects.get(id)
          if (!existing) {
            const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
            visual.__tileX = obj.x
            visual.__tileY = obj.y
            this.applyLabelScale(visual)
            this.objects.set(id, visual)
            this.container.addChild(visual)
          } else {
            const tx = obj.x * TILE_SIZE
            const ty = obj.y * TILE_SIZE
            if (obj.type === 'creep') {
              const dx = obj.x - (existing.__tileX ?? obj.x)
              const dy = obj.y - (existing.__tileY ?? obj.y)
              if (dx !== 0 || dy !== 0) {
                existing.__angle = Math.atan2(dy, dx)
                if (existing.__bodyContainer) existing.__bodyContainer.rotation = existing.__angle
              }
              existing.__tileX = obj.x
              existing.__tileY = obj.y
              if (this.instantMode) {
                existing.position.set(tx, ty)
                existing.__targetX = undefined
                existing.__targetY = undefined
                existing.__moveStartX = undefined
                existing.__moveStartY = undefined
                existing.__moveStartT = undefined
                existing.__moveDur = undefined
              } else if (existing.x !== tx || existing.y !== ty) {
                existing.__targetX = tx
                existing.__targetY = ty
                existing.__moveStartX = existing.x
                existing.__moveStartY = existing.y
                existing.__moveStartT = performance.now()
                existing.__moveDur = this.moveDuration
              }
              const { used, capacity } = getCreepStore(obj)
              if (existing.__creepUsed !== used || existing.__creepCapacity !== capacity) {
                this.startCreepFillAnimation(id, existing, existing.__creepUsed ?? 0, existing.__creepCapacity ?? capacity, used, capacity)
                existing.__creepUsed = used
                existing.__creepCapacity = capacity
              }
            } else if (obj.type === 'flag') {
              const newColorIdx = typeof obj.color === 'number' ? obj.color : 0
              const newSecColorIdx = typeof obj.secondaryColor === 'number' ? obj.secondaryColor : 0
              const colorChanged =
                existing.__flagColor !== newColorIdx ||
                existing.__flagSecondaryColor !== newSecColorIdx
              if (colorChanged) {
                this.container.removeChild(existing)
                destroyVisual(existing)
                this.objects.delete(id)
                const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
                visual.__tileX = obj.x
                visual.__tileY = obj.y
                this.applyLabelScale(visual)
                this.objects.set(id, visual)
                this.container.addChild(visual)
              } else {
                existing.position.set(tx, ty)
              }
            } else {
              existing.position.set(tx, ty)
            }

            if (obj.type === 'extension') {
              const { energy, capacity } = getExtensionEnergy(obj)
              const ext = existing as ContainerWithTarget & { __extEnergy?: number; __extCapacity?: number }
              if (ext.__extEnergy !== energy || ext.__extCapacity !== capacity) {
                this.startExtAnimation(
                  id,
                  existing,
                  ext.__extEnergy ?? 0,
                  ext.__extCapacity ?? capacity,
                  energy,
                  capacity,
                )
                ext.__extEnergy = energy
                ext.__extCapacity = capacity
              }
            }
            if (obj.type === 'link') {
              const { energy, capacity } = getExtensionEnergy(obj)
              if (existing.__linkEnergy !== energy || existing.__linkCapacity !== capacity) {
                this.startLinkAnimation(id, existing, existing.__linkEnergy ?? 0, existing.__linkCapacity ?? capacity, energy, capacity)
                existing.__linkEnergy = energy
                existing.__linkCapacity = capacity
              }
            }
            if (obj.type === 'tower') {
              const { energy, capacity } = getExtensionEnergy(obj)
              if (existing.__towerEnergy !== energy || existing.__towerCapacity !== capacity) {
                this.startTowerFillAnimation(id, existing, existing.__towerEnergy ?? 0, existing.__towerCapacity ?? capacity, energy, capacity)
                existing.__towerEnergy = energy
                existing.__towerCapacity = capacity
              }
            }
            if (obj.type === 'storage') {
              const { bands, used, capacity } = getStoreBands(obj)
              if (existing.__storageUsed !== used || existing.__storageCapacity !== capacity) {
                const fromUsed = existing.__storageUsed ?? 0
                const fromCap = existing.__storageCapacity ?? capacity
                existing.__storageBands = bands
                existing.__storageUsed = used
                existing.__storageCapacity = capacity
                this.startStorageFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
              } else if (!bandsEqual(existing.__storageBands, bands)) {
                existing.__storageBands = bands
                updateStorageFill(existing, calcStorageFillHeight(used, capacity))
              }
            }
            if (obj.type === 'container') {
              const { bands, used, capacity } = getStoreBands(obj)
              if (existing.__containerUsed !== used || existing.__containerCapacity !== capacity) {
                const fromUsed = existing.__containerUsed ?? 0
                const fromCap = existing.__containerCapacity ?? capacity
                existing.__containerBands = bands
                existing.__containerUsed = used
                existing.__containerCapacity = capacity
                this.startContainerFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
              } else if (!bandsEqual(existing.__containerBands, bands)) {
                existing.__containerBands = bands
                updateContainerFill(existing, calcContainerFillHeight(used, capacity))
              }
            }
            if (obj.type === 'terminal') {
              const { used, capacity, dominant: dom } = getStoreBands(obj)
              const dominant = dom ?? undefined
              if (existing.__terminalDominant !== dominant) {
                existing.__terminalDominant = dominant
                existing.__terminalFillColor = dominant ? resourceColor(dominant) : ST_ENERGY
                updateTerminalFill(existing, calcCenterFillFraction(used, capacity))
              }
              if (existing.__terminalUsed !== used || existing.__terminalCapacity !== capacity) {
                const fromUsed = existing.__terminalUsed ?? 0
                const fromCap = existing.__terminalCapacity ?? capacity
                existing.__terminalUsed = used
                existing.__terminalCapacity = capacity
                this.startTerminalFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
              }
            }
            if (obj.type === 'lab') {
              const { energy, energyCap, mineralType, mineral, mineralCap } = getLabContents(obj)
              const newType = mineralType ?? undefined
              if (existing.__labMineralType !== newType) {
                existing.__labMineralType = newType
                existing.__labMineralColor = mineralType ? resourceColor(mineralType) : undefined
                updateLabFill(existing, calcCenterFillFraction(energy, energyCap), calcCenterFillFraction(mineral, mineralCap))
              }
              if (existing.__labEnergy !== energy || existing.__labEnergyCap !== energyCap ||
                  existing.__labMineral !== mineral || existing.__labMineralCap !== mineralCap) {
                const fromE = existing.__labEnergy ?? 0
                const fromECap = existing.__labEnergyCap ?? energyCap
                const fromM = existing.__labMineral ?? 0
                const fromMCap = existing.__labMineralCap ?? mineralCap
                existing.__labEnergy = energy
                existing.__labEnergyCap = energyCap
                existing.__labMineral = mineral
                existing.__labMineralCap = mineralCap
                this.startLabFillAnimation(id, existing, fromE, fromECap, fromM, fromMCap, energy, energyCap, mineral, mineralCap)
              }
            }
            if (obj.type === 'nuker') {
              const { energy, energyCap, ghodium, ghodiumCap } = getNukerContents(obj)
              if (existing.__nukerEnergy !== energy || existing.__nukerEnergyCap !== energyCap ||
                  existing.__nukerGhodium !== ghodium || existing.__nukerGhodiumCap !== ghodiumCap) {
                const fromE = existing.__nukerEnergy ?? 0
                const fromECap = existing.__nukerEnergyCap ?? energyCap
                const fromG = existing.__nukerGhodium ?? 0
                const fromGCap = existing.__nukerGhodiumCap ?? ghodiumCap
                existing.__nukerEnergy = energy
                existing.__nukerEnergyCap = energyCap
                existing.__nukerGhodium = ghodium
                existing.__nukerGhodiumCap = ghodiumCap
                this.startNukerFillAnimation(id, existing, fromE, fromECap, fromG, fromGCap, energy, energyCap, ghodium, ghodiumCap)
              }
            }
            if (obj.type === 'factory') {
              const { bands, used, capacity } = getStoreBands(obj)
              const level = typeof obj.level === 'number' ? obj.level : 0
              const active = factoryActive(obj)
              if (existing.__factoryLevel !== level && existing.__factoryRingG) {
                existing.__factoryLevel = level
                drawFactoryRing(existing.__factoryRingG, level)
              }
              if (existing.__factoryActive !== active) {
                existing.__factoryActive = active
                // Stopped producing — reset the outline to its static colour.
                if (!active && existing.__factoryGearG) drawFactoryGear(existing.__factoryGearG, existing.__factoryGlowColor ?? ST_OUTLINE)
              }
              if (existing.__factoryUsed !== used || existing.__factoryCapacity !== capacity) {
                const fromUsed = existing.__factoryUsed ?? 0
                const fromCap = existing.__factoryCapacity ?? capacity
                existing.__factoryBands = bands
                existing.__factoryUsed = used
                existing.__factoryCapacity = capacity
                this.startFactoryFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
              } else if (!bandsEqual(existing.__factoryBands, bands)) {
                existing.__factoryBands = bands
                updateFactoryFill(existing, calcFactoryFillHeight(used, capacity))
              }
            }
            if (obj.type === 'controller') {
              const level         = typeof obj.level         === 'number' ? obj.level         : 0
              const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
              const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 0
              const newResObj     = obj.reservation as { user?: string } | undefined
              const newUserId     = typeof obj.user === 'string' ? obj.user
                : typeof newResObj?.user === 'string' ? newResObj.user
                : undefined
              if (existing.__ctrlUserId !== newUserId) {
                this.container.removeChild(existing)
                destroyVisual(existing)
                this.objects.delete(id)
                const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
                visual.__tileX = obj.x
                visual.__tileY = obj.y
                this.applyLabelScale(visual)
                this.objects.set(id, visual)
                this.container.addChild(visual)
                continue
              }
              if (existing.__ctrlLevel !== level || existing.__ctrlProgress !== progress || existing.__ctrlProgressTotal !== progressTotal) {
                if (existing.__ctrlSegSprites) {
                  if (!this.instantMode && level < 8 && progress > (existing.__ctrlProgress ?? 0)) {
                    this.ctrlFlashAnimations.set(id, { segIndex: level, startTime: performance.now(), duration: 400 })
                  }
                  updateControllerSegSprites(existing, level, progress, progressTotal)
                } else if (existing.__ctrlSegGraphics) {
                  drawControllerSegments(existing.__ctrlSegGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CTRL_SEG_OUT, CTRL_SEG_IN, level, progress, progressTotal)
                }
                existing.__ctrlLevel         = level
                existing.__ctrlProgress      = progress
                existing.__ctrlProgressTotal = progressTotal
              }
              const newDt = typeof obj.downgradeTime === 'number' ? obj.downgradeTime : undefined
              if (existing.__ctrlDowngradeTime !== newDt) existing.__ctrlDowngradeTime = newDt
            }
            if (obj.type === 'source') {
              const { energy, capacity } = getSourceEnergy(obj)
              if (existing.__sourceEnergy !== energy || existing.__sourceCapacity !== capacity) {
                this.startSourceAnimation(id, existing, existing.__sourceEnergy ?? 0, existing.__sourceCapacity ?? capacity, energy, capacity)
                existing.__sourceEnergy = energy
                existing.__sourceCapacity = capacity
              }
            }
            if (obj.type === 'constructionSite') {
              const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
              const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 1
              if (existing.__csProgress !== progress || existing.__csProgressTotal !== progressTotal) {
                if (existing.__csFillGraphics) {
                  drawCSProgress(existing.__csFillGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CS_FILL_R, progress, progressTotal, existing.__csColor ?? CS_OWN)
                }
                existing.__csProgress      = progress
                existing.__csProgressTotal = progressTotal
              }
            }
          }
        }
      }
    } else {
      const seen = new Set<string>()

      // Use for...in to prevent unnecessary array allocation
      for (const id in objects) {
        const obj = objects[id]
        if (!obj) continue

        seen.add(id)
        this.rawObjects.set(id, obj)
        const existing = this.objects.get(id)
        if (!existing) {
          const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
          visual.__tileX = obj.x
          visual.__tileY = obj.y
          this.applyLabelScale(visual)
          this.objects.set(id, visual)
          this.container.addChild(visual)
        } else {
          const tx = obj.x * TILE_SIZE
          const ty = obj.y * TILE_SIZE
          if (obj.type === 'creep') {
            const dx = obj.x - (existing.__tileX ?? obj.x)
            const dy = obj.y - (existing.__tileY ?? obj.y)
            if (dx !== 0 || dy !== 0) {
              existing.__angle = Math.atan2(dy, dx)
              if (existing.__bodyContainer) existing.__bodyContainer.rotation = existing.__angle
            }
            existing.__tileX = obj.x
            existing.__tileY = obj.y
            if (this.instantMode) {
              existing.position.set(tx, ty)
              existing.__targetX = undefined
              existing.__targetY = undefined
              existing.__moveStartX = undefined
              existing.__moveStartY = undefined
              existing.__moveStartT = undefined
              existing.__moveDur = undefined
            } else if (existing.x !== tx || existing.y !== ty) {
              existing.__targetX = tx
              existing.__targetY = ty
              existing.__moveStartX = existing.x
              existing.__moveStartY = existing.y
              existing.__moveStartT = performance.now()
              existing.__moveDur = this.moveDuration
            }
            const { used, capacity } = getCreepStore(obj)
            if (existing.__creepUsed !== used || existing.__creepCapacity !== capacity) {
              this.startCreepFillAnimation(id, existing, existing.__creepUsed ?? 0, existing.__creepCapacity ?? capacity, used, capacity)
              existing.__creepUsed = used
              existing.__creepCapacity = capacity
            }
          } else if (obj.type === 'flag') {
            const newColorIdx = typeof obj.color === 'number' ? obj.color : 0
            const newSecColorIdx = typeof obj.secondaryColor === 'number' ? obj.secondaryColor : 0
            const colorChanged =
              existing.__flagColor !== newColorIdx ||
              existing.__flagSecondaryColor !== newSecColorIdx
            if (colorChanged) {
              this.container.removeChild(existing)
              destroyVisual(existing)
              this.objects.delete(id)
              const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
              visual.__tileX = obj.x
              visual.__tileY = obj.y
              this.applyLabelScale(visual)
              this.objects.set(id, visual)
              this.container.addChild(visual)
            } else {
              existing.position.set(tx, ty)
            }
          } else {
            existing.position.set(tx, ty)
          }

          if (obj.type === 'extension') {
            const { energy, capacity } = getExtensionEnergy(obj)
            const ext = existing as ContainerWithTarget & { __extEnergy?: number; __extCapacity?: number }
            if (ext.__extEnergy !== energy || ext.__extCapacity !== capacity) {
              this.startExtAnimation(
                id,
                existing,
                ext.__extEnergy ?? 0,
                ext.__extCapacity ?? capacity,
                energy,
                capacity,
              )
              ext.__extEnergy = energy
              ext.__extCapacity = capacity
            }
          }
          if (obj.type === 'link') {
            const { energy, capacity } = getExtensionEnergy(obj)
            if (existing.__linkEnergy !== energy || existing.__linkCapacity !== capacity) {
              this.startLinkAnimation(id, existing, existing.__linkEnergy ?? 0, existing.__linkCapacity ?? capacity, energy, capacity)
              existing.__linkEnergy = energy
              existing.__linkCapacity = capacity
            }
          }
          if (obj.type === 'tower') {
            const { energy, capacity } = getExtensionEnergy(obj)
            if (existing.__towerEnergy !== energy || existing.__towerCapacity !== capacity) {
              this.startTowerFillAnimation(id, existing, existing.__towerEnergy ?? 0, existing.__towerCapacity ?? capacity, energy, capacity)
              existing.__towerEnergy = energy
              existing.__towerCapacity = capacity
            }
          }
          if (obj.type === 'controller') {
            const level         = typeof obj.level         === 'number' ? obj.level         : 0
            const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
            const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 0
            const newResObj     = obj.reservation as { user?: string } | undefined
            const newUserId     = typeof obj.user === 'string' ? obj.user
              : typeof newResObj?.user === 'string' ? newResObj.user
              : undefined
            if (existing.__ctrlUserId !== newUserId) {
              this.container.removeChild(existing)
              destroyVisual(existing)
              this.objects.delete(id)
              const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users, this.activeTheme, this.atlasCache)
              visual.__tileX = obj.x
              visual.__tileY = obj.y
              this.applyLabelScale(visual)
              this.objects.set(id, visual)
              this.container.addChild(visual)
              continue
            }
            if (existing.__ctrlLevel !== level || existing.__ctrlProgress !== progress || existing.__ctrlProgressTotal !== progressTotal) {
              if (existing.__ctrlSegSprites) {
                if (!this.instantMode && level > (existing.__ctrlLevel ?? 0) && level > 0) {
                  this.ctrlFlashAnimations.set(id, { segIndex: level - 1, startTime: performance.now(), duration: 500 })
                }
                updateControllerSegSprites(existing, level, progress, progressTotal)
              } else if (existing.__ctrlSegGraphics) {
                drawControllerSegments(existing.__ctrlSegGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CTRL_SEG_OUT, CTRL_SEG_IN, level, progress, progressTotal)
              }
              existing.__ctrlLevel         = level
              existing.__ctrlProgress      = progress
              existing.__ctrlProgressTotal = progressTotal
            }
            const newDt = typeof obj.downgradeTime === 'number' ? obj.downgradeTime : undefined
            if (existing.__ctrlDowngradeTime !== newDt) existing.__ctrlDowngradeTime = newDt
          }
          if (obj.type === 'source') {
            const { energy, capacity } = getSourceEnergy(obj)
            if (existing.__sourceEnergy !== energy || existing.__sourceCapacity !== capacity) {
              this.startSourceAnimation(id, existing, existing.__sourceEnergy ?? 0, existing.__sourceCapacity ?? capacity, energy, capacity)
              existing.__sourceEnergy = energy
              existing.__sourceCapacity = capacity
            }
          }
          if (obj.type === 'constructionSite') {
            const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
            const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 1
            if (existing.__csProgress !== progress || existing.__csProgressTotal !== progressTotal) {
              if (existing.__csFillGraphics) {
                drawCSProgress(existing.__csFillGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CS_FILL_R, progress, progressTotal, existing.__csColor ?? CS_OWN)
              }
              existing.__csProgress      = progress
              existing.__csProgressTotal = progressTotal
            }
          }
        }
      }

      // Remove objects that no longer exist
      for (const [id, visual] of this.objects) {
        if (!seen.has(id)) {
          this.container.removeChild(visual)
          destroyVisual(visual)
          this.objects.delete(id)
          this.rawObjects.delete(id)
          this.fillAnimations.delete(id)
          this.buildGlowAnimations.delete(id)
          this.ctrlFlashAnimations.delete(id)
          this.sayBubbles.delete(id)
        }
      }

      roadsChanged = true
      wallsChanged = true
      rampartsChanged = true
    }

    if (wallsChanged) {
      this.redrawWalls()
    }
    if (rampartsChanged) {
      this.redrawRamparts()
    }
    if (roadsChanged) {
      this.redrawRoads()
    }

    // Drive every spawn's progress ring from the local game clock. Re-sync the
    // completion tick only when the spawning payload changes (the server doesn't
    // reliably re-send remainingTime each tick), then advance locally so the ring
    // keeps progressing every tick instead of freezing between server updates.
    for (const [id, visual] of this.objects) {
      if (!visual.__spawnRing) continue
      const obj = this.rawObjects.get(id)
      const sig = obj ? spawnSig(obj) : null
      if (sig !== visual.__spawnSig) {
        visual.__spawnSig = sig
        const t = obj && sig ? spawnTiming(obj, this.currentGameTime) : null
        visual.__spawnNeedTime = t?.needTime
        visual.__spawnEndTime = t?.endTime
      }
      const ratio = visual.__spawnNeedTime !== undefined && visual.__spawnEndTime !== undefined
        ? spawnRatio(visual.__spawnNeedTime, visual.__spawnEndTime, this.currentGameTime)
        : null
      if (ratio !== visual.__spawnRatio) {
        drawSpawnRing(visual.__spawnRing, ratio)
        visual.__spawnRatio = ratio
      }
    }

    this.refreshForeignCreepLabels()
    this.refreshForeignCreepBadges()
  }

  private redrawWalls(): void {
    this.wallGraphics.clear()
    this.wallMarkGraphics.clear()

    const T = TILE_SIZE
    const R = T / 2
    const grid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    const walls: Array<{ x: number; y: number }> = []

    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'constructedWall' && typeof obj.x === 'number' && typeof obj.y === 'number' &&
          obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
        grid[obj.x][obj.y] = true
        walls.push({ x: obj.x, y: obj.y })
      }
    }

    if (walls.length === 0) return

    const drawQuadrants = (g: Graphics) => {
      let drawn = false
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          const center = grid[x][y]
          const top    = y > 0  && grid[x][y - 1]
          const bottom = y < 49 && grid[x][y + 1]
          const left   = x > 0  && grid[x - 1][y]
          const right  = x < 49 && grid[x + 1][y]
          const cx = x * T + R
          const cy = y * T + R

          // Top-Left
          if (center) {
            drawn = true
            if (!top && !left && y > 0 && x > 0) {
              g.moveTo(cx, y * T); g.arc(cx, cy, R, -Math.PI / 2, Math.PI, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(x * T, y * T, R, R)
            }
          } else if (top && left && grid[x - 1][y - 1]) {
            drawn = true
            g.moveTo(cx, y * T); g.lineTo(x * T, y * T); g.lineTo(x * T, cy)
            g.arc(cx, cy, R, Math.PI, -Math.PI / 2, false); g.closePath()
          }

          // Top-Right
          if (center) {
            if (!top && !right && y > 0 && x < 49) {
              g.moveTo(cx, y * T); g.arc(cx, cy, R, -Math.PI / 2, 0, false); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(cx, y * T, R, R)
            }
          } else if (top && right && grid[x + 1][y - 1]) {
            drawn = true
            g.moveTo(cx, y * T); g.lineTo(x * T + T, y * T); g.lineTo(x * T + T, cy)
            g.arc(cx, cy, R, 0, -Math.PI / 2, true); g.closePath()
          }

          // Bottom-Left
          if (center) {
            if (!bottom && !left && y < 49 && x > 0) {
              g.moveTo(x * T, cy); g.arc(cx, cy, R, Math.PI, Math.PI / 2, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(x * T, cy, R, R)
            }
          } else if (bottom && left && grid[x - 1][y + 1]) {
            drawn = true
            g.moveTo(x * T, cy); g.lineTo(x * T, y * T + T); g.lineTo(cx, y * T + T)
            g.arc(cx, cy, R, Math.PI / 2, Math.PI, false); g.closePath()
          }

          // Bottom-Right
          if (center) {
            if (!bottom && !right && y < 49 && x < 49) {
              g.moveTo(cx, y * T + T); g.arc(cx, cy, R, Math.PI / 2, 0, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(cx, cy, R, R)
            }
          } else if (bottom && right && grid[x + 1][y + 1]) {
            drawn = true
            g.moveTo(cx, y * T + T); g.lineTo(x * T + T, y * T + T); g.lineTo(x * T + T, cy)
            g.arc(cx, cy, R, 0, Math.PI / 2, false); g.closePath()
          }
        }
      }
      return drawn
    }

    const borderStroke = { color: TERRAIN_WALL_BORDER, width: T * 0.06, alignment: 0 as const, cap: 'round' as const, join: 'round' as const }
    if (drawQuadrants(this.wallGraphics)) this.wallGraphics.stroke(borderStroke)
    drawQuadrants(this.wallGraphics)
    this.wallGraphics.fill(ST_DARK)

    // Dash marks — two staggered short dashes per tile to distinguish from terrain walls
    const dashW = T * 0.32
    const dashH = T * 0.09
    for (const { x, y } of walls) {
      const tx = x * T
      const ty = y * T
      this.wallMarkGraphics.rect(tx + T * 0.12, ty + T * 0.30, dashW, dashH)
      this.wallMarkGraphics.rect(tx + T * 0.56, ty + T * 0.58, dashW, dashH)
    }
    this.wallMarkGraphics.fill({ color: 0x404040 })
  }

  private redrawRoads(): void {
    this.roadGraphics.clear()
    const color = this.roadColor

    const roadGrid = Array.from({ length: 50 }, () => new Array(50).fill(false))
    const roads: RoomObject[] = []

    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'road') {
        roads.push(obj)
        if (obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
          roadGrid[obj.x][obj.y] = true
        }
      }
    }

    if (roads.length === 0) return

    const cxOffset = TILE_SIZE / 2
    const cyOffset = TILE_SIZE / 2
    const radius = TILE_SIZE * 0.125

    // Draw center dots
    for (const r of roads) {
      this.roadGraphics.circle(r.x * TILE_SIZE + cxOffset, r.y * TILE_SIZE + cyOffset, radius)
    }
    this.roadGraphics.fill(color)

    // Draw connections
    const neighbors = [
      [1, 0],   // right
      [1, 1],   // bottom-right
      [0, 1],   // bottom
      [-1, 1],  // bottom-left
    ]

    for (const r of roads) {
      const cx = r.x * TILE_SIZE + cxOffset
      const cy = r.y * TILE_SIZE + cyOffset

      for (const [dx, dy] of neighbors) {
        const nx = r.x + dx
        const ny = r.y + dy
        if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && roadGrid[nx][ny]) {
          const ncx = nx * TILE_SIZE + cxOffset
          const ncy = ny * TILE_SIZE + cyOffset
          this.roadGraphics.moveTo(cx, cy)
          this.roadGraphics.lineTo(ncx, ncy)
        }
      }
    }
    this.roadGraphics.stroke({ width: radius * 2, color })
  }

  private redrawRamparts(): void {
    this.rampartGraphics.clear()
    this.rampartGlowGraphics.clear()
    const T = TILE_SIZE
    const R = T / 2

    const grid = Array.from({ length: 50 }, () => new Array<string | undefined>(50).fill(undefined))
    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'rampart' && obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
        grid[obj.x][obj.y] = typeof obj.user === 'string' ? obj.user : undefined
      }
    }

    // Drawn on top of structures as a uniform translucent green wash (vanilla overlay):
    // one alpha for every tile, so a ramparted structure simply reads through as a green
    // tint. Varying alpha per tile (faint over structures, bright over terrain) drew a
    // visible darker square around each structure where the two alphas met.
    const rampartColor = (user: string | undefined): { color: number; alpha: number } => {
      if (!user || !this.currentUserId) return { color: ST_RAMPART, alpha: 0.4 }
      return user === this.currentUserId
        ? { color: ST_RAMPART, alpha: 0.4 }
        : { color: ST_RAMPART_ENEMY, alpha: 0.36 }
    }

    // Glowing perimeter rim hugging each rampart blob, grouped by owner category so
    // own/neutral get a green rim and foreign ramparts a red one. Drawn on top of the
    // fills (below) as a multi-pass soft glow — see strokeBorder.
    const greenGrid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    const redGrid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const u = grid[x][y]
        if (u === undefined) continue
        if (!this.currentUserId || u === this.currentUserId) greenGrid[x][y] = true
        else redGrid[x][y] = true
      }
    }

    const strokeBorder = (bgrid: boolean[][], color: number) => {
      // Trace the outer perimeter path of every blob onto `g` — rounded convex
      // corners, rounded concave notches, and exposed straight tile edges. Interior
      // quadrant boundaries are skipped so the translucent fill stays clean. Returns
      // false if nothing was emitted. PixiJS consumes the path on stroke(), so each
      // target re-traces it.
      const trace = (g: Graphics): boolean => {
        let drawn = false
        const seg = (x0: number, y0: number, x1: number, y1: number) => {
          g.moveTo(x0, y0); g.lineTo(x1, y1); drawn = true
        }
        const arc = (sx: number, sy: number, a0: number, a1: number, ccw: boolean, cxc: number, cyc: number) => {
          g.moveTo(sx, sy); g.arc(cxc, cyc, R, a0, a1, ccw); drawn = true
        }
        for (let y = 0; y < 50; y++) {
          for (let x = 0; x < 50; x++) {
            const top    = y > 0  && bgrid[x][y - 1]
            const bottom = y < 49 && bgrid[x][y + 1]
            const left   = x > 0  && bgrid[x - 1][y]
            const right  = x < 49 && bgrid[x + 1][y]
            const dTL = x > 0  && y > 0  && bgrid[x - 1][y - 1]
            const dTR = x < 49 && y > 0  && bgrid[x + 1][y - 1]
            const dBL = x > 0  && y < 49 && bgrid[x - 1][y + 1]
            const dBR = x < 49 && y < 49 && bgrid[x + 1][y + 1]
            const cx = x * T + R
            const cy = y * T + R
            if (bgrid[x][y]) {
              // Convex corners round; straight half-edges otherwise. A half-edge that
              // runs into a concave corner (rounded by a diagonal empty tile's arc) is
              // suppressed so it stops at the arc instead of overshooting to a sharp point.
              // Top-Left
              if (!top && !left && y > 0 && x > 0) arc(cx, y * T, -Math.PI / 2, Math.PI, true, cx, cy)
              else { if (!top && !(left && dTL)) seg(x * T, y * T, cx, y * T); if (!left && !(top && dTL)) seg(x * T, y * T, x * T, cy) }
              // Top-Right
              if (!top && !right && y > 0 && x < 49) arc(cx, y * T, -Math.PI / 2, 0, false, cx, cy)
              else { if (!top && !(right && dTR)) seg(cx, y * T, x * T + T, y * T); if (!right && !(top && dTR)) seg(x * T + T, y * T, x * T + T, cy) }
              // Bottom-Left
              if (!bottom && !left && y < 49 && x > 0) arc(x * T, cy, Math.PI, Math.PI / 2, true, cx, cy)
              else { if (!bottom && !(left && dBL)) seg(x * T, y * T + T, cx, y * T + T); if (!left && !(bottom && dBL)) seg(x * T, cy, x * T, y * T + T) }
              // Bottom-Right
              if (!bottom && !right && y < 49 && x < 49) arc(cx, y * T + T, Math.PI / 2, 0, true, cx, cy)
              else { if (!bottom && !(right && dBR)) seg(cx, y * T + T, x * T + T, y * T + T); if (!right && !(bottom && dBR)) seg(x * T + T, cy, x * T + T, y * T + T) }
            } else {
              // Rounded concave notches around an empty tile cornered by ramparts
              if (top && left && dTL) arc(x * T, cy, Math.PI, -Math.PI / 2, false, cx, cy)
              if (top && right && dTR) arc(x * T + T, cy, 0, -Math.PI / 2, true, cx, cy)
              if (bottom && left && dBL) arc(cx, y * T + T, Math.PI / 2, Math.PI, false, cx, cy)
              if (bottom && right && dBR) arc(x * T + T, cy, 0, Math.PI / 2, false, cx, cy)
            }
          }
        }
        return drawn
      }
      // butt caps (not round): the perimeter is emitted as disjoint per-tile segments,
      // so round caps would stack a half-circle at every shared endpoint and bead the
      // line. Adjacent segments are collinear/tangent, so butt caps meet flush.
      // Wide bright stroke on the blurred glow layer (below the fills) → a soft glow
      // that haloes past the blob edge and tints up through the translucent fill.
      if (trace(this.rampartGlowGraphics)) this.rampartGlowGraphics.stroke({ color, width: T * 0.3, alpha: 0.55, alignment: 0.5, cap: 'butt', join: 'round' })
      // Crisp core rim on top of the fills.
      if (trace(this.rampartGraphics)) this.rampartGraphics.stroke({ color, width: T * 0.08, alpha: 0.9, alignment: 0.5, cap: 'butt', join: 'round' })
    }

    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const centerUser = grid[x][y]
        const center = centerUser !== undefined
        const top = y > 0 && grid[x][y - 1] !== undefined
        const bottom = y < 49 && grid[x][y + 1] !== undefined
        const left = x > 0 && grid[x - 1][y] !== undefined
        const right = x < 49 && grid[x + 1][y] !== undefined

        const cx = x * T + R
        const cy = y * T + R

        // Top-Left Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!top && !left && y > 0 && x > 0) {
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.arc(cx, cy, R, -Math.PI / 2, Math.PI, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(x * T, y * T, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (top && left && grid[x - 1][y - 1] !== undefined) {
            const color = rampartColor(grid[x - 1][y - 1])
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.lineTo(x * T, y * T)
            this.rampartGraphics.lineTo(x * T, cy)
            this.rampartGraphics.arc(cx, cy, R, Math.PI, -Math.PI / 2, false)
            this.rampartGraphics.fill(color)
          }
        }

        // Top-Right Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!top && !right && y > 0 && x < 49) {
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.arc(cx, cy, R, -Math.PI / 2, 0, false)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(cx, y * T, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (top && right && grid[x + 1][y - 1] !== undefined) {
            const color = rampartColor(grid[x + 1][y - 1])
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.lineTo(x * T + T, y * T)
            this.rampartGraphics.lineTo(x * T + T, cy)
            this.rampartGraphics.arc(cx, cy, R, 0, -Math.PI / 2, true)
            this.rampartGraphics.fill(color)
          }
        }

        // Bottom-Left Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!bottom && !left && y < 49 && x > 0) {
            this.rampartGraphics.moveTo(x * T, cy)
            this.rampartGraphics.arc(cx, cy, R, Math.PI, Math.PI / 2, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(x * T, cy, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (bottom && left && grid[x - 1][y + 1] !== undefined) {
            const color = rampartColor(grid[x - 1][y + 1])
            this.rampartGraphics.moveTo(x * T, cy)
            this.rampartGraphics.lineTo(x * T, y * T + T)
            this.rampartGraphics.lineTo(cx, y * T + T)
            this.rampartGraphics.arc(cx, cy, R, Math.PI / 2, Math.PI, false)
            this.rampartGraphics.fill(color)
          }
        }

        // Bottom-Right Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!bottom && !right && y < 49 && x < 49) {
            this.rampartGraphics.moveTo(cx, y * T + T)
            this.rampartGraphics.arc(cx, cy, R, Math.PI / 2, 0, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(cx, cy, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (bottom && right && grid[x + 1][y + 1] !== undefined) {
            const color = rampartColor(grid[x + 1][y + 1])
            this.rampartGraphics.moveTo(cx, y * T + T)
            this.rampartGraphics.lineTo(x * T + T, y * T + T)
            this.rampartGraphics.lineTo(x * T + T, cy)
            this.rampartGraphics.arc(cx, cy, R, 0, Math.PI / 2, false)
            this.rampartGraphics.fill(color)
          }
        }
      }
    }

    // Brighter perimeter rim drawn on top of the fills
    strokeBorder(greenGrid, ST_RAMPART_STROKE)
    strokeBorder(redGrid, ST_RAMPART_ENEMY_STROKE)
  }

  /**
   * Return all objects whose tile position matches (tx, ty).
   * For creeps the tile is derived from their *target* (data) position, not
   * the interpolated visual position, so selection is consistent.
   */
  getObjectsAtTile(tx: number, ty: number): ObjectEntry[] {
    const result: ObjectEntry[] = []
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj) continue
      if (obj.x === tx && obj.y === ty) {
        result.push({ id, obj, visual })
      }
    }
    return result
  }

  /**
   * Apply the current world-scale to a visual's name label.
   * Run after creating a visual so newly-spawned creeps get the right label scale
   * even when the room is already zoomed (lastWorldScale ≠ 1).
   */
  private applyLabelScale(visual: ContainerWithTarget): void {
    const worldScale = this.lastWorldScale || 1
    if (visual.__nameLabel) {
      visual.__nameLabel.scale.set(LABEL_FONT_SCALE / worldScale)
      if (visual.__nameLabel.anchor.y === 0) {
        // Flag label — anchored at top, positioned below the flag
        visual.__nameLabel.y = TILE_SIZE / 2 + TILE_SIZE * 0.55
      } else {
        // Creep label — anchored at bottom, positioned above the creep
        visual.__nameLabel.y = LABEL_CREEP_TOP - LABEL_GAP_PX / worldScale
      }
    }
    if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
      // Pivot is at tail tip; place tail tip just above the creep with a fixed screen-pixel gap.
      visual.__sayBubble.scale.set(1 / worldScale)
      visual.__sayBubble.position.set(TILE_SIZE / 2, LABEL_CREEP_TOP - SAY_GAP_PX / worldScale)
    }
  }

  /**
   * Refresh foreign-creep labels from the current users map. When a foreign creep
   * spawns into an already-watched room the users map may not yet contain the
   * owner's username; once it does, we update the label from <userId> to <username>.
   */
  private refreshForeignCreepLabels(): void {
    if (!this.currentUserId) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'creep') continue
      if (!visual.__nameLabel) continue
      if (!isForeignCreep(obj, this.currentUserId)) continue
      const userId = typeof obj.user === 'string' ? obj.user : undefined
      const labelText = userId ? (this.users?.[userId]?.username ?? userId) : 'Hostile'
      if (visual.__nameLabel.text !== labelText) {
        visual.__nameLabel.text = labelText
      }
    }
  }

  /**
   * Add badge sprites to foreign creeps whose user data (including badge) arrived
   * after the visual was initially created. Replaces the red foreign-mark fill
   * with the proper badge once the badge texture is resolved.
   */
  private refreshForeignCreepBadges(): void {
    if (!this.currentUserId) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'creep') continue
      if (!isForeignCreep(obj, this.currentUserId)) continue
      if (visual.__creepBadgeSprite) continue  // badge already wired up
      const creepUserId = typeof obj.user === 'string' ? obj.user : undefined
      const creepBadge = creepUserId ? this.users?.[creepUserId]?.badge : undefined
      if (!creepBadge) continue
      const bodyContainer = visual.__bodyContainer
      if (!bodyContainer) continue

      // Remove the red foreign-mark placeholder if present
      if (visual.__creepForeignMark && !visual.__creepForeignMark.destroyed) {
        bodyContainer.removeChild(visual.__creepForeignMark)
        visual.__creepForeignMark.destroy()
        visual.__creepForeignMark = undefined
      }

      const badgeSprite = new Sprite()
      badgeSprite.anchor.set(0.5, 0.5)
      const size = CREEP_INNER_R * 2
      badgeSprite.width = size
      badgeSprite.height = size
      badgeSprite.rotation = Math.PI / 2
      bodyContainer.addChild(badgeSprite)
      visual.__creepBadgeSprite = badgeSprite
      this.badgeCache.getOrCreate(creepBadge as Badge).then((texture) => {
        if (!badgeSprite.destroyed) badgeSprite.texture = texture
      }).catch(() => {
        if (!badgeSprite.destroyed) {
          bodyContainer.removeChild(badgeSprite)
          badgeSprite.destroy()
        }
        visual.__creepBadgeSprite = undefined
      })
    }
  }

  /** Trigger the yellow build-glow on the construction site at the given tile, if any. */
  triggerBuildAt(tx: number, ty: number, durationMs: number): void {
    if (this.instantMode) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'constructionSite') continue
      if (obj.x !== tx || obj.y !== ty) continue
      if (!visual.__csBuildGlow) continue
      this.buildGlowAnimations.set(id, { startTime: performance.now(), duration: durationMs })
      return
    }
  }

  /**
   * Aim a tower's barrel at a target tile and hold there for `durationMs` (the
   * action beam duration). When the hold expires the idle sweep resumes from the
   * current angle. No-op in instant/history mode.
   */
  triggerTowerAim(id: string, tx: number, ty: number, durationMs: number): void {
    if (this.instantMode) return
    const visual = this.objects.get(id)
    if (!visual || !visual.__barrelContainer) return
    const obj = this.rawObjects.get(id)
    if (!obj) return
    const dx = tx - obj.x
    const dy = ty - obj.y
    if (dx === 0 && dy === 0) return
    visual.__towerAimAngle = Math.atan2(dy, dx) + TOWER_BARREL_FORWARD
    visual.__towerAimUntil = performance.now() + durationMs
  }

  /**
   * Show a speech bubble above the given creep. Lifetime is governed by the
   * caller — see pruneSayBubblesExcept(). Calling with the same message for a
   * creep already showing a bubble is a no-op (no destroy/recreate flicker).
   */
  triggerSay(creepId: string, message: string): void {
    const visual = this.objects.get(creepId)
    if (!visual) return

    if (visual.__sayMessage === message && visual.__sayBubble && !visual.__sayBubble.destroyed) {
      return
    }

    if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
      visual.removeChild(visual.__sayBubble)
      visual.__sayBubble.destroy({ children: true })
    }

    const bubble = buildSayBubble(message)
    visual.addChild(bubble)
    visual.__sayBubble = bubble
    visual.__sayMessage = message
    this.applyLabelScale(visual)
    this.sayBubbles.add(creepId)
  }

  /** Duration (ms) that creep movement interpolations should span. */
  setMoveDuration(ms: number): void {
    this.moveDuration = Math.max(0, ms)
  }

  /**
   * Remove say bubbles for creeps that did *not* speak this tick. The only
   * lifecycle signal for bubbles — called from RoomViewer after the per-tick
   * actionLog loop, so the bubble is on while the creep is in `activeSayers`
   * and off otherwise. No timers involved.
   */
  pruneSayBubblesExcept(activeSayers: ReadonlySet<string>): void {
    if (this.sayBubbles.size === 0) return
    for (const id of this.sayBubbles) {
      if (activeSayers.has(id)) continue
      const visual = this.objects.get(id)
      if (visual?.__sayBubble && !visual.__sayBubble.destroyed) {
        visual.removeChild(visual.__sayBubble)
        visual.__sayBubble.destroy({ children: true })
      }
      if (visual) {
        visual.__sayBubble = undefined
        visual.__sayMessage = undefined
      }
      this.sayBubbles.delete(id)
    }
  }

  setInstantMode(enabled: boolean): void {
    this.instantMode = enabled
    if (!enabled) return
    for (const visual of this.objects.values()) {
      if (visual.__targetX !== undefined) {
        visual.position.set(visual.__targetX, visual.__targetY!)
        visual.__targetX = undefined
        visual.__targetY = undefined
        visual.__moveStartX = undefined
        visual.__moveStartY = undefined
        visual.__moveStartT = undefined
        visual.__moveDur = undefined
      }
      if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
        visual.removeChild(visual.__sayBubble)
        visual.__sayBubble.destroy({ children: true })
        visual.__sayBubble = undefined
        visual.__sayMessage = undefined
      }
    }
    this.sayBubbles.clear()
    for (const anim of this.fillAnimations.values()) anim.apply(anim.visual, anim.toA, anim.toB)
    this.fillAnimations.clear()
    this.buildGlowAnimations.clear()
    this.ctrlFlashAnimations.clear()
  }

  setShowLabels(show: boolean): void {
    this.showLabels = show
    for (const visual of this.objects.values()) {
      if (visual.__nameLabel) visual.__nameLabel.visible = show
    }
  }

  /** Return the live PixiJS container for an object by id, if present. */
  getVisualById(id: string): ContainerWithTarget | undefined {
    return this.objects.get(id)
  }

  clear(): void {
    for (const visual of this.objects.values()) {
      destroyVisual(visual)
    }
    this.objects.clear()
    this.rawObjects.clear()
    this.fillAnimations.clear()
    this.buildGlowAnimations.clear()
    this.ctrlFlashAnimations.clear()
    this.sayBubbles.clear()
    this.roadGraphics.clear()
    this.rampartGraphics.clear()
    this.rampartGlowGraphics.clear()
    this.container.removeChildren()
    // Re-attach persistent graphics layers removed by removeChildren()
    this.container.addChild(this.rampartGraphics)
    this.container.addChild(this.rampartGlowGraphics)
    this.container.addChild(this.roadGraphics)
  }

  destroy(): void {
    this.clear()
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback)
    }
    this.ticker = null
    this.tickerCallback = null
  }
}
