import { Container, Graphics, Rectangle, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { ROOM_SIZE, TILE_SIZE } from './RoomRenderer.js'
import { destroyTree } from './destroyTree.js'
import { REFERENCE_CELL_SIZE } from './roomDecorations.js'

/**
 * Ambient level of the light map, and the reference's own (`renderer-metadata.js`, the
 * `lighting` layer's `afterCreate`): a flat `0x808080` rectangle over the room, composited
 * with MULTIPLY, so anything unlit renders at half brightness. Lights SCREEN the map back
 * towards white; wall shadows MULTIPLY it further down.
 */
const AMBIENT = 0x808080

/**
 * Side of the shared glow texture, in pixels. The reference's `glow.png` is 256²; every
 * pool is that one texture scaled to its own size, so this only sets how finely the
 * falloff is sampled, not how large a pool is.
 */
const GRADIENT_TEXTURE_SIZE = 128

/** One light pool, transcribed from a `layer: 'lighting'` sprite in the reference metadata. */
export interface Glow {
  /** Diameter, in the reference's units (100 per tile) — the metadata's `width`. */
  size: number
  /** Brightness at the centre — the metadata's `alpha`. */
  alpha: number
  /** Pool colour; white (untinted) when absent, as in the metadata. */
  tint?: number
}

export interface Light {
  id: string
  /** Light centre in room-pixel space (e.g. (tileX + 0.5) * TILE_SIZE). */
  cx: number
  cy: number
  /** Pools this object contributes, drawn over one another at its centre. */
  glows: readonly Glow[]
}

interface LightEntry {
  glows: readonly Glow[]
  sprites: Sprite[]
}

// GPU lightmap: a mid-grey full-room rectangle, darkened where walls cast shadow and
// brightened around each lit object, composited into a RenderTexture and multiplied over
// the world as a single sprite.
//
// Why a RenderTexture and not the world tree directly: the contributions blend against
// each other, not against the scene. A light has to SCREEN the *map* towards white — done
// straight on the world it would screen the terrain instead and wash it out.
//
// The set of lights is reconciled once per game tick (setLights). Individual
// light positions are nudged every frame (setLightPosition) so a light pool
// tracks its creep's interpolated motion instead of snapping at tick end. Both
// only flip a dirty flag; render() does the actual GPU work, once per frame and
// only when something moved — so an idle room costs nothing.
export class LightingLayer {
  readonly displaySprite: Sprite
  private readonly renderer: Renderer
  private readonly rt: RenderTexture
  private readonly scene: Container
  private readonly gradientTexture: Texture
  private readonly lights = new Map<string, LightEntry>()
  /** Baked terrain contribution: wall shadows and lit wall faces. Owned by this layer. */
  private wallSprites: Sprite[] = []
  private wallGeneration = 0
  private dirty = false
  private destroyed = false

  constructor(renderer: Renderer) {
    this.renderer = renderer
    this.gradientTexture = buildGradientTexture()

    this.rt = RenderTexture.create({ width: ROOM_SIZE, height: ROOM_SIZE })

    this.scene = new Container({ sortableChildren: true })
    const ambient = new Graphics()
    ambient.rect(0, 0, ROOM_SIZE, ROOM_SIZE)
    ambient.fill(AMBIENT)
    ambient.zIndex = 0
    this.scene.addChild(ambient)

    this.displaySprite = new Sprite(this.rt)
    // The whole point of the map: it scales the scene under it rather than veiling it.
    this.displaySprite.blendMode = 'multiply'
    this.render()
  }

  /**
   * Adopt the terrain's lighting contribution from `createWallLighting`.
   *
   * Both halves are flattened to a texture here and kept as plain sprites. This scene
   * re-renders on every frame that a creep moves, so nothing in it may carry a filter or
   * a full-room vector path — the shadow's blur would otherwise be recomputed at 60fps.
   *
   * `shadow` and `lit` are consumed: they are destroyed once baked. Returns a generation
   * token for `clearWallLighting`.
   */
  setWallLighting(contribution: { shadow: Container; lit: Container }): number {
    this.disposeWallLighting()
    this.wallSprites = [
      this.bake(contribution.shadow, 'multiply'),
      this.bake(contribution.lit, 'screen'),
    ]
    for (const sprite of this.wallSprites) {
      sprite.zIndex = 1
      this.scene.addChild(sprite)
    }
    // Composite now rather than flagging dirty. Lights can wait for the frame that moved
    // them, but this is a one-off structural change and nothing else drives a render until
    // the next game tick — on a slow server that left a room standing shadowless, then
    // popping, for as long as a tick.
    this.dirty = true
    this.render()
    return ++this.wallGeneration
  }

  /**
   * Withdraw the contribution identified by `generation`, if it is still the active one.
   *
   * A terrain layer calls this as it is destroyed, and a room switch may already have
   * registered its successor by then — an unconditional clear would blank the new room's
   * shadows on the way out.
   */
  clearWallLighting(generation: number): void {
    if (generation !== this.wallGeneration) return
    this.disposeWallLighting()
    this.dirty = true
    this.render()
  }

  private bake(source: Container, blendMode: 'multiply' | 'screen'): Sprite {
    const frame = new Rectangle(0, 0, ROOM_SIZE, ROOM_SIZE)
    const texture = this.renderer.generateTexture({ target: source, frame })
    // destroyTree takes the shadow's blur with it — built per room, dead once baked — and
    // frees each Graphics' own context while leaving the cached wall shape alone: that one
    // is shared with the terrain layer's own masks and outlives anything baked from it.
    destroyTree(source)

    const sprite = new Sprite(texture)
    sprite.blendMode = blendMode
    return sprite
  }

  private disposeWallLighting(): void {
    for (const sprite of this.wallSprites) {
      sprite.removeFromParent()
      sprite.destroy({ texture: true, textureSource: true })
    }
    this.wallSprites = []
  }

  // Reconcile the live set of lights (called once per tick). Adds sprites for
  // new ids, removes those that vanished, and repositions the rest. An object
  // whose pools changed — a spawn that ran dry, an extension that filled — has
  // its sprites rebuilt, since a pool's size and alpha are baked into them.
  setLights(lights: readonly Light[]): void {
    const seen = new Set<string>()
    for (const { id, cx, cy, glows } of lights) {
      seen.add(id)
      let entry = this.lights.get(id)
      if (entry && !sameGlows(entry.glows, glows)) {
        this.disposeLight(entry)
        entry = undefined
      }
      if (!entry) {
        entry = { glows, sprites: glows.map((glow) => this.createGlow(glow)) }
        this.lights.set(id, entry)
      }
      for (const sprite of entry.sprites) sprite.position.set(cx, cy)
    }
    for (const [id, entry] of this.lights) {
      if (seen.has(id)) continue
      this.disposeLight(entry)
      this.lights.delete(id)
    }
    this.dirty = true
  }

  // Nudge one light to follow its object's interpolated position (called every
  // frame from ObjectLayer.tick). No-op for ids that aren't lit, so callers can
  // fire it for every moving object without checking.
  setLightPosition(id: string, cx: number, cy: number): void {
    const entry = this.lights.get(id)
    if (!entry) return
    for (const sprite of entry.sprites) {
      if (sprite.x === cx && sprite.y === cy) continue
      sprite.position.set(cx, cy)
      this.dirty = true
    }
  }

  private createGlow(glow: Glow): Sprite {
    const sprite = new Sprite(this.gradientTexture)
    sprite.anchor.set(0.5)
    const size = glow.size * TILE_SIZE / REFERENCE_CELL_SIZE
    sprite.setSize(size, size)
    sprite.alpha = glow.alpha
    if (glow.tint !== undefined) sprite.tint = glow.tint
    // Lights sit above the wall shadow so a lit wall face still reads as lit.
    sprite.blendMode = 'screen'
    sprite.zIndex = 2
    this.scene.addChild(sprite)
    return sprite
  }

  private disposeLight(entry: LightEntry): void {
    for (const sprite of entry.sprites) sprite.destroy()
  }

  // Composite the lightmap into the RenderTexture if anything changed. Cheap
  // no-op otherwise. Must run before the main frame is presented.
  render(): void {
    if (this.destroyed || !this.dirty) return
    this.renderer.render({ container: this.scene, target: this.rt, clear: true })
    this.dirty = false
  }

  clear(): void {
    for (const entry of this.lights.values()) this.disposeLight(entry)
    this.lights.clear()
    this.dirty = true
    this.render()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const entry of this.lights.values()) this.disposeLight(entry)
    this.lights.clear()
    this.disposeWallLighting()
    destroyTree(this.scene)
    this.rt.destroy(true)
    this.gradientTexture.destroy(true)
    this.displaySprite.destroy()
  }
}

function sameGlows(a: readonly Glow[], b: readonly Glow[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].size !== b[i].size || a[i].alpha !== b[i].alpha || a[i].tint !== b[i].tint) return false
  }
  return true
}

// A soft white disc (alpha 1 at centre → 0 at the edge) used by every light — the
// reference's `glow.png`, whose alpha ramps linearly over the same geometry.
// Screened over the ambient grey this drives the map to white at the centre — so the
// world below is multiplied by 1 and reads at full brightness — feathering to ambient.
function buildGradientTexture(): Texture {
  const size = GRADIENT_TEXTURE_SIZE
  const r = size / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fill()
  return Texture.from(canvas)
}
