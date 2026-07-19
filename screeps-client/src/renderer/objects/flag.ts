import { Text, Sprite, Texture } from 'pixi.js'
import type { FlagSpec } from '../themes/Theme.js'
import { sharedAtlasCache } from '../AtlasCache.js'
import { defaultSpriteTheme } from '../themes/default.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { FLAG_COLORS } from '../colors.js'
import { LABEL_FONT_SCALE, LABEL_FONT_SIZE } from './creep.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Flag visuals: tinted atlas sprites (or a drawn flag) with a name label.
export function createFlagVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, showLabel } = ctx
  const colorIdx = typeof obj.color === 'number' ? obj.color : 0
  const secColorIdx = typeof obj.secondaryColor === 'number' ? obj.secondaryColor : 0
  const flagColor = FLAG_COLORS[colorIdx] ?? FLAG_COLORS[0]
  const secColor = FLAG_COLORS[secColorIdx] ?? FLAG_COLORS[0]

  const flagSpec: FlagSpec | undefined = defaultSpriteTheme.flag
  if (flagSpec) {
    const targetSize = TILE_SIZE * flagSpec.tileScale
    const loadAtlas = (): Promise<import('pixi.js').Spritesheet> => sharedAtlasCache.getOrLoad(defaultSpriteTheme.atlasUrl)
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

    const mainTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, flagSpec.mainFrame)
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

      const secondTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, flagSpec.secondFrame)
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
}
