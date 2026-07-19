import { Graphics, Text, Sprite, Texture } from 'pixi.js'
import { sharedAtlasCache } from '../AtlasCache.js'
import { defaultSpriteTheme } from '../themes/default.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJ_CYAN, DEPOSIT_COLORS } from '../colors.js'
import { type VisualBuildContext } from './types.js'

// Mineral disc + deposit sprite visuals.
// ── Mineral helpers ────────────────────────────────────────────────────────
// Room-view minerals render as the reference client does: a colour-tinted disc
// (bright stroked ring + dark fill) with the mineral's letter in the ring colour.
// The map overlay keeps the spritesheet sprite (see MapRenderer); only the room
// view uses this vector disc, so it stays crisp at every zoom level.
export const MINERAL_DISC: Record<string, { stroke: number; fill: number }> = {
  H: { stroke: 0xcccccc, fill: 0x4d4d4d },
  O: { stroke: 0xcccccc, fill: 0x4d4d4d },
  U: { stroke: 0x88d6f7, fill: 0x1b617f },
  L: { stroke: 0x89f4a5, fill: 0x3f6147 },
  K: { stroke: 0x9370ff, fill: 0x331a80 },
  Z: { stroke: 0xf2d28b, fill: 0x594d33 },
  X: { stroke: 0xff7a7a, fill: 0x4f2626 },
}
export const MINERAL_DISC_DEFAULT = { stroke: OBJ_CYAN, fill: 0x333333 }
// Fill layer is kept mostly transparent so the rock shape reads through it.
export const DEPOSIT_FILL_ALPHA = 0.2
export const MINERAL_R = TILE_SIZE * 0.58
export const MINERAL_STROKE_W = MINERAL_R / 6          // reference: stroke-width 10 vs radius 60
export const MINERAL_GLYPH_FONT = 32
export const MINERAL_GLYPH_SCALE = (MINERAL_R * 1.4) / MINERAL_GLYPH_FONT  // letter roughly fills the ring
export function createMineralVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy } = ctx
  // Room view: a colour-tinted disc + letter glyph (reference-client style).
  // Spritesheet mineral frames are reserved for the map overlay.
  const mtype = typeof obj.mineralType === 'string' ? obj.mineralType : '?'
  const disc = MINERAL_DISC[mtype] ?? MINERAL_DISC_DEFAULT
  const discG = new Graphics()
  discG.circle(cx, cy, MINERAL_R)
  discG.fill(disc.fill)
  discG.stroke({ width: MINERAL_STROKE_W, color: disc.stroke })
  container.addChild(discG)
  const glyph = new Text({
    text: mtype,
    style: { fontSize: MINERAL_GLYPH_FONT, fill: disc.stroke, fontWeight: 'bold' },
  })
  glyph.anchor.set(0.5, 0.5)
  glyph.scale.set(MINERAL_GLYPH_SCALE)
  glyph.position.set(cx, cy)
  container.addChild(glyph)
}
export function createDepositVisual(ctx: VisualBuildContext): void {
  const { color, obj, container, g, cx, cy } = ctx
  const depType = typeof obj.depositType === 'string' ? obj.depositType : undefined
  const depSpec = defaultSpriteTheme.deposit
  if (depType && depSpec) {
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
      const tex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, frame)
      if (tex) {
        applyTexture(sprite, tex)
      } else {
        sharedAtlasCache.getOrLoad(defaultSpriteTheme.atlasUrl).then(sheet => {
          if (!sprite.destroyed) applyTexture(sprite, sheet.textures[frame] ?? Texture.EMPTY)
        }).catch(() => {})
      }
    }
    return
  }
  // Fallback: colored rect (unknown deposit type)
  g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
  g.fill(color)
  container.addChild(g)
}
