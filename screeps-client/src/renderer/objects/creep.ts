import { Container, Graphics, GraphicsContext, Text, Sprite, FillGradient } from 'pixi.js'
import type { RoomObject, Badge } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { BODY_PART_COLORS, BG_DEEP, BG_DARK, OBJ_FOREIGN, ENERGY_FILL, CREEP_RING_DARK, CREEP_NOTCH, INVADER_BORDER, INVADER_FILL_TOP, INVADER_FILL_BOT } from '../colors.js'
import { spts } from './common.js'
import { markSharedContext } from '../destroyTree.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Creep visuals: body-part arcs, badges, store fill, NPC invader gem, name labels, say bubbles.
export const CREEP_OUTER_R = TILE_SIZE * 0.44
export const CREEP_INNER_R = TILE_SIZE * 0.28
export const CREEP_MAX_BODY = 50
// Heading of a creep that hasn't moved yet: notch up. Local angle 0 points right.
export const CREEP_IDLE_FACING = -Math.PI / 2

export const LABEL_FONT_SIZE  = 32
export const LABEL_FONT_SCALE = 12 / LABEL_FONT_SIZE  // base scale: ~12px height at world-scale=1
// Label bottom sits GAP_PX screen-pixels above the creep outer edge; constant across zoom levels.
export const LABEL_CREEP_TOP = TILE_SIZE / 2 - TILE_SIZE * 0.44  // CREEP_OUTER_R in container space
export const LABEL_GAP_PX    = 2

// Speech bubble (creep.say) — designed in "world units" with SAY_FONT_SCALE baked into the
// text scale. The whole bubble container then gets (1 / worldScale) applied so its on-screen
// size stays constant across zoom levels (same trick as __nameLabel).
export const SAY_FONT_SCALE = (12 * 1.2) / LABEL_FONT_SIZE  // ~14.4px tall at world-scale=1 (20% bigger than name labels)
export const SAY_PAD_X      = 5
export const SAY_PAD_Y      = 2.5
export const SAY_TAIL_W     = 2.0
export const SAY_TAIL_H     = 2.6
export const SAY_GAP_PX     = 2     // screen-pixel gap between creep edge and tail tip
export const SAY_MAX_CHARS  = 12    // server already caps say() at 10 chars; defensive trim
export const SAY_BG_COLOR   = 0xf0f0f0
export const SAY_TX_COLOR   = 0x1a1a1a

export function drawCreepArc(g: Graphics, startAngle: number, endAngle: number, color: number): void {
  if (endAngle - startAngle < 0.001) return
  g.moveTo(CREEP_OUTER_R * Math.cos(startAngle), CREEP_OUTER_R * Math.sin(startAngle))
  g.arc(0, 0, CREEP_OUTER_R, startAngle, endAngle)
  g.lineTo(CREEP_INNER_R * Math.cos(endAngle), CREEP_INNER_R * Math.sin(endAngle))
  g.arc(0, 0, CREEP_INNER_R, endAngle, startAngle, true)
  g.closePath()
  g.fill(color)
}

// gem silhouette as fractions of TILE_SIZE: apex, shoulders (widest), flat base.
export const INVADER_PTS: ReadonlyArray<readonly [number, number]> = [
  [0, -0.30], [0.22, 0.05], [0.15, 0.20], [-0.15, 0.20], [-0.22, 0.05],
]
export const INVADER_BORDER_W = TILE_SIZE * 0.073

// All invaders are identical, so build the gem geometry + gradient texture once in
// a shared context and instance it per creep. The per-creep Graphics is registered with
// markSharedContext so destroyTree leaves this context standing for the next invader.
let invaderContext: GraphicsContext | null = null
export function getInvaderContext(): GraphicsContext {
  if (invaderContext) return invaderContext
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const pts = spts(cx, cy, INVADER_PTS)
  const fill = new FillGradient({
    type: 'linear',
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    colorStops: [
      { offset: 0, color: INVADER_FILL_TOP },
      { offset: 1, color: INVADER_FILL_BOT },
    ],
  })
  // Stroke the outline (uniform width) rather than insetting a scaled polygon,
  // which would taper the border at the apex.
  invaderContext = new GraphicsContext()
    .poly(pts).fill(fill)
    .poly(pts).stroke({ width: INVADER_BORDER_W, color: INVADER_BORDER, alignment: 0.5, join: 'miter', miterLimit: 6 })
  return invaderContext
}

// __bodyContainer is left unset so tick() skips facing-rotation.
export function drawInvaderCreep(container: ContainerWithTarget): void {
  container.addChild(markSharedContext(new Graphics({ context: getInvaderContext() })))
}

export function getCreepStore(obj: RoomObject): { used: number; capacity: number } {
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

export function calcCreepFillRadius(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return CREEP_INNER_R * 0.8 * Math.min(1, used / capacity)
}

export function updateCreepFill(visual: Container, radius: number): void {
  const fill = (visual as Container & { __creepFillGraphics?: Graphics }).__creepFillGraphics
  if (!fill) return
  fill.clear()
  if (radius > 0) {
    fill.circle(0, 0, radius)
    fill.fill(ENERGY_FILL)
  }
}

export function isForeignCreep(obj: RoomObject, currentUserId?: string): boolean {
  const creepUser = obj.user
  if (typeof creepUser !== 'string') return false
  if (!currentUserId) return false
  return creepUser !== currentUserId
}

// NPC users are never sent in the client `users` map, so detect by the engine's
// stable NPC user ids rather than username (which would never resolve). Invaders
// and Source Keepers both render as the red gem; only the label differs. Returns
// the display name for an NPC creep, or null if the creep isn't an NPC.
export const USER_INVADER = '2'
export const USER_SOURCE_KEEPER = '3'
export function npcCreepName(obj: RoomObject, users?: Record<string, { username: string }>): string | null {
  const u = typeof obj.user === 'string' ? obj.user : undefined
  if (!u) return null
  if (u === USER_INVADER || users?.[u]?.username === 'Invader') return 'Invader'
  if (u === USER_SOURCE_KEEPER || users?.[u]?.username === 'Source Keeper') return 'Source Keeper'
  return null
}

export function buildSayBubble(message: string): Container {
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
export function buildCreepBody(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, currentUserId, badgeCache, users } = ctx
  // Invaders and Source Keepers both render as the red gem.
  if (npcCreepName(obj, users)) {
    drawInvaderCreep(container as ContainerWithTarget)
    return
  }

  const FULL = 2 * Math.PI

  const bodyContainer = new Container()
  bodyContainer.position.set(cx, cy)
  bodyContainer.rotation = CREEP_IDLE_FACING

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
    badgeSprite.rotation = -CREEP_IDLE_FACING
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
}
/**
 * Point a creep at `angle` (radians, 0 = right — the notch's local direction).
 *
 * The owner badge lives inside the rotating body container so the store fill can cover
 * it, but a badge must read upright at any heading, so it counter-rotates. Anything else
 * that must stay level belongs here too.
 */
export function setCreepFacing(visual: ContainerWithTarget, angle: number): void {
  const body = visual.__bodyContainer
  if (!body) return
  body.rotation = angle
  if (visual.__creepBadgeSprite) visual.__creepBadgeSprite.rotation = -angle
}

export function attachCreepNameLabel(ctx: VisualBuildContext): void {
  const { obj, container, cx, currentUserId, users, showLabel } = ctx
  // Label for creeps — rendered at high font size, scaled down so it stays crisp when zoomed.
  // Base scale gives ~8px height at world-scale=1; ObjectLayer.tick() divides by world-scale
  // so the label stays constant in screen pixels and shrinks relative to the creep when zoomed in.
  if (typeof obj.name === 'string') {
    const isForeign = isForeignCreep(obj, currentUserId)
    let labelText: string
    if (isForeign) {
      const userId = typeof obj.user === 'string' ? obj.user : undefined
      labelText = npcCreepName(obj, users) ?? (userId ? (users?.[userId]?.username ?? userId) : 'Hostile')
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
}
export function createCreepVisual(ctx: VisualBuildContext): void {
  buildCreepBody(ctx)
  attachCreepNameLabel(ctx)
}
