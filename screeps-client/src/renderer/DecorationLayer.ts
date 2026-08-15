import { Container, Sprite, TilingSprite, type Ticker } from 'pixi.js'
import type { RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE, Z } from './RoomRenderer.js'
import { createWallMask } from './TerrainLayer.js'
import { loadDecorationTexture } from './decorationTextures.js'
import { DecorationAnimator } from './decorationAnimation.js'
import { destroyTree } from './destroyTree.js'
import { REFERENCE_CELL_SIZE, type DecorationSprite, type GraffitiDecoration } from './roomDecorations.js'

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
/** Where one graffiti sits, in room cells. Mirrors the editor's `Placement`. */
export interface GraffitiTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export class DecorationLayer {
  readonly base: Container
  private readonly baseContent: Container
  private readonly animator: DecorationAnimator
  private destroyed = false
  /** Sprites per decoration id, so the in-room editor can move one without a rebuild. */
  private readonly spritesById = new Map<string, Array<Sprite | TilingSprite>>()
  private readonly items = new Map<string, GraffitiDecoration>()
  /** Live transforms from the editor, kept for sprites whose texture resolves later. */
  private readonly transforms = new Map<string, GraffitiTransform>()

  constructor(graffiti: readonly GraffitiDecoration[], terrain: RoomTerrain, ticker: Ticker) {
    this.animator = new DecorationAnimator(ticker)

    this.base = new Container()
    this.base.label = 'decorations'
    this.base.zIndex = Z.decorations
    this.baseContent = this.maskedContent(this.base, terrain)

    for (const item of graffiti) {
      this.items.set(item.id, item)
      for (const sprite of item.sprites) {
        this.addSprite(this.baseContent, item, sprite)
      }
    }
  }

  destroy(): void {
    this.destroyed = true
    this.animator.destroy()
    this.spritesById.clear()
    this.transforms.clear()
    // destroyTree, not `{ children: true }`: the wall mask is a full-room path whose
    // GraphicsContext the object form of destroy would strand on the renderer.
    this.baseContent.mask = null
    destroyTree(this.base)
  }

  /**
   * Move, resize or turn one decoration in place.
   *
   * The in-room editor calls this on every pointer move, so it must not touch the scene
   * graph: rebuilding the layer would re-create the wall mask and re-await every texture.
   * Pass `null` to fall back to the decoration's stored placement.
   */
  setTransform(id: string, transform: GraffitiTransform | null): void {
    if (transform) this.transforms.set(id, transform)
    else this.transforms.delete(id)

    const sprites = this.spritesById.get(id)
    if (!sprites) return
    for (const sprite of sprites) this.applyTransform(sprite, id)
  }

  /** Position a sprite from its decoration's placement, or the editor's override. */
  private applyTransform(sprite: Sprite | TilingSprite, id: string): void {
    const item = this.items.get(id)
    if (!item) return
    const geometry = this.transforms.get(id) ?? item

    const width = geometry.width * TILE_SIZE
    const height = geometry.height * TILE_SIZE
    if (sprite instanceof TilingSprite) {
      sprite.width = width
      sprite.height = height
    } else {
      // setSize drives the sprite's scale off the texture, so the flip has to be
      // re-applied after it rather than multiplied in once at creation.
      sprite.setSize(width, height)
    }

    // The reference grid puts cell (0,0)'s centre at the origin, ours puts its
    // top-left corner there — hence half a cell more than the reference formula.
    sprite.x = Math.floor((geometry.x + geometry.width / 2) * TILE_SIZE)
    sprite.y = Math.floor((geometry.y + geometry.height / 2) * TILE_SIZE)
    sprite.scale.x = Math.abs(sprite.scale.x) * (item.flip ? -1 : 1)
    sprite.rotation = geometry.rotation
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

      let sprite: Sprite | TilingSprite
      if (spec.tiling) {
        const tiled = new TilingSprite({ texture, width: item.width * TILE_SIZE, height: item.height * TILE_SIZE })
        // The reference sizes the same sprite in CELL_SIZE units, so its tileScale counts
        // reference pixels per texture pixel. Ours must be rebased onto TILE_SIZE or the
        // artwork repeats ~8× too often for the same authored number.
        tiled.tileScale.set(spec.tileScale * TILE_SIZE / REFERENCE_CELL_SIZE)
        sprite = tiled
      } else {
        sprite = new Sprite(texture)
      }

      sprite.anchor.set(0.5)
      if (spec.tint != null) sprite.tint = spec.tint

      const known = this.spritesById.get(item.id)
      if (known) known.push(sprite)
      else this.spritesById.set(item.id, [sprite])
      // Placement runs through the same path the editor uses, so a drag that started
      // before this texture resolved is already accounted for.
      this.applyTransform(sprite, item.id)

      holder.addChild(sprite)
      if (item.animation) this.animator.add(sprite, item.animation)
    }).catch(() => { /* texture load failed — silently skip this graphic */ })
  }
}
