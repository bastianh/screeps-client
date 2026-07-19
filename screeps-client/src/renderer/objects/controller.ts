import { Graphics, Sprite, Texture } from 'pixi.js'
import type { Badge } from 'screeps-connectivity'
import type { ControllerSpec } from '../themes/Theme.js'
import { sharedAtlasCache } from '../AtlasCache.js'
import { defaultSpriteTheme } from '../themes/default.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK } from '../colors.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Controller visuals: octagon with RCL segments, owner badge, and progress arcs.
// ── Controller helpers ─────────────────────────────────────────────────────

export const CTRL_OCTO_R  = TILE_SIZE * 0.65
export const CTRL_SEG_OUT = CTRL_OCTO_R
export const CTRL_SEG_IN  = TILE_SIZE * 0.42

export function drawControllerSegments(
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

export function updateControllerSegSprites(container: ContainerWithTarget, level: number, progress: number, progressTotal: number): void {
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
export function createControllerVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, badgeCache, users } = ctx
  const level        = typeof obj.level         === 'number' ? obj.level         : 0
  const progress     = typeof obj.progress      === 'number' ? obj.progress      : 0
  const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 0

  const resObj = obj.reservation as { user?: string } | undefined
  const ctrlUserId = typeof obj.user === 'string' ? obj.user
    : typeof resObj?.user === 'string' ? resObj.user
    : undefined
  const ctrlBadge = ctrlUserId ? users?.[ctrlUserId]?.badge : undefined

  const ctrlSpec: ControllerSpec | undefined = defaultSpriteTheme.controller
  if (ctrlSpec) {
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

    const loadAtlas = (): Promise<import('pixi.js').Spritesheet> => sharedAtlasCache.getOrLoad(defaultSpriteTheme.atlasUrl)
    const bgTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, ctrlSpec.backgroundFrame)
    if (bgTex) {
      bgSprite.texture = bgTex
    } else {
      loadAtlas().then(sheet => {
        if (!bgSprite.destroyed) bgSprite.texture = sheet.textures[ctrlSpec.backgroundFrame] ?? Texture.EMPTY
      }).catch(() => {})
    }
    const existingSegTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, ctrlSpec.segmentFrame)
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
}
