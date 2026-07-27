import { Container, Sprite, TilingSprite, type Ticker } from 'pixi.js'
import type { RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE, Z } from './RoomRenderer.js'
import { createWallMask } from './TerrainLayer.js'
import { loadDecorationTexture } from './decorationTextures.js'
import { DecorationAnimator } from './decorationAnimation.js'
import type { DecorationSprite, GraffitiDecoration } from './roomDecorations.js'

/**
 * Renders `wallGraffiti` decorations: free-floating images masked to the room's walls.
 *
 * The decoration's `lighting` flag gets no separate pass. The reference draws a second,
 * untinted copy into a layer that is a *light map* — ambient grey, multiplied over the
 * scene — where those copies are never seen as artwork, only as bright spots. Our
 * darkness works the same way already (`LightingLayer` erases holes in an overlay), so
 * the artwork is drawn once, tinted. Drawing that second copy as a normal sprite would
 * paint an untinted white shape straight over the real one.
 */
export class DecorationLayer {
  readonly base: Container
  private readonly baseContent: Container
  private readonly animator: DecorationAnimator
  private destroyed = false

  constructor(graffiti: readonly GraffitiDecoration[], terrain: RoomTerrain, ticker: Ticker) {
    this.animator = new DecorationAnimator(ticker)

    this.base = new Container()
    this.base.label = 'decorations'
    this.base.zIndex = Z.decorations
    this.baseContent = this.maskedContent(this.base, terrain)

    for (const item of graffiti) {
      for (const sprite of item.sprites) {
        this.addSprite(this.baseContent, item, sprite)
      }
    }
  }

  destroy(): void {
    this.destroyed = true
    this.animator.destroy()
    this.base.destroy({ children: true })
  }

  private maskedContent(root: Container, terrain: RoomTerrain): Container {
    const mask = createWallMask(terrain)
    const content = new Container()
    content.mask = mask
    root.addChild(mask, content)
    return content
  }

  private addSprite(parent: Container, item: GraffitiDecoration, spec: DecorationSprite): void {
    // Static alphas live on the holder so an animation can own the sprite's own alpha
    // outright; the two then multiply instead of overwriting each other.
    const holder = new Container()
    holder.alpha = item.alpha * spec.alpha
    parent.addChild(holder)

    loadDecorationTexture(spec.url).then((texture) => {
      if (this.destroyed || holder.destroyed) return

      const width = item.width * TILE_SIZE
      const height = item.height * TILE_SIZE
      let sprite: Sprite | TilingSprite
      if (spec.tiling) {
        const tiled = new TilingSprite({ texture, width, height })
        tiled.tileScale.set(spec.tileScale)
        sprite = tiled
      } else {
        sprite = new Sprite(texture)
        sprite.setSize(width, height)
      }

      sprite.anchor.set(0.5)
      // The reference grid puts cell (0,0)'s centre at the origin, ours puts its
      // top-left corner there — hence half a cell more than the reference formula.
      sprite.x = Math.floor((item.x + item.width / 2) * TILE_SIZE)
      sprite.y = Math.floor((item.y + item.height / 2) * TILE_SIZE)
      if (spec.tint != null) sprite.tint = spec.tint
      if (item.flip) sprite.scale.x *= -1
      sprite.rotation = item.rotation

      holder.addChild(sprite)
      if (item.animation) this.animator.add(sprite, item.animation)
    }).catch(() => { /* texture load failed — silently skip this graphic */ })
  }
}
