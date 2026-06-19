import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { ROOM_SIZE, TILE_SIZE } from './RoomRenderer.js'

// Darkness applied over the whole room (matches the previous canvas overlay).
const DARK_ALPHA = 0.2
// Radius of the light pool punched around each lit object, in tiles. Kept as a
// tile multiplier (not a module-level pixel constant) so this module doesn't
// read TILE_SIZE at eval time — RoomRenderer imports us, so its TILE_SIZE is
// still in its temporal dead zone while this module's top level runs.
const LIGHT_RADIUS_TILES = 3

export interface Light {
  id: string
  /** Light centre in room-pixel space (e.g. (tileX + 0.5) * TILE_SIZE). */
  cx: number
  cy: number
}

// GPU lightmap: a dark full-room rectangle with soft holes erased around each
// lit object, composited into a RenderTexture and shown as a single sprite.
//
// Why a RenderTexture and not the world tree directly: the holes use the
// `erase` blend mode, which subtracts from the destination's alpha. Rendering
// the dark rect + erase sprites into their *own* texture keeps that erase
// contained to the lightmap — it cuts the darkness, not the terrain/page below.
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
  private readonly lights = new Map<string, Sprite>()
  private dirty = false
  private destroyed = false

  constructor(renderer: Renderer) {
    this.renderer = renderer
    this.gradientTexture = buildGradientTexture()

    this.rt = RenderTexture.create({ width: ROOM_SIZE, height: ROOM_SIZE })

    this.scene = new Container()
    const dark = new Graphics()
    dark.rect(0, 0, ROOM_SIZE, ROOM_SIZE)
    dark.fill({ color: 0x000000, alpha: DARK_ALPHA })
    this.scene.addChild(dark)

    this.displaySprite = new Sprite(this.rt)
    this.render()
  }

  // Reconcile the live set of lights (called once per tick). Adds sprites for
  // new ids, removes those that vanished, and repositions the rest.
  setLights(lights: readonly Light[]): void {
    const seen = new Set<string>()
    for (const { id, cx, cy } of lights) {
      seen.add(id)
      let sprite = this.lights.get(id)
      if (!sprite) {
        sprite = new Sprite(this.gradientTexture)
        sprite.anchor.set(0.5)
        sprite.blendMode = 'erase'
        this.scene.addChild(sprite)
        this.lights.set(id, sprite)
      }
      sprite.position.set(cx, cy)
    }
    for (const [id, sprite] of this.lights) {
      if (seen.has(id)) continue
      sprite.destroy()
      this.lights.delete(id)
    }
    this.dirty = true
  }

  // Nudge one light to follow its object's interpolated position (called every
  // frame from ObjectLayer.tick). No-op for ids that aren't lit, so callers can
  // fire it for every moving object without checking.
  setLightPosition(id: string, cx: number, cy: number): void {
    const sprite = this.lights.get(id)
    if (!sprite) return
    if (sprite.x === cx && sprite.y === cy) return
    sprite.position.set(cx, cy)
    this.dirty = true
  }

  // Composite the lightmap into the RenderTexture if anything changed. Cheap
  // no-op otherwise. Must run before the main frame is presented.
  render(): void {
    if (this.destroyed || !this.dirty) return
    this.renderer.render({ container: this.scene, target: this.rt, clear: true })
    this.dirty = false
  }

  clear(): void {
    for (const sprite of this.lights.values()) sprite.destroy()
    this.lights.clear()
    this.dirty = true
    this.render()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const sprite of this.lights.values()) sprite.destroy()
    this.lights.clear()
    this.scene.destroy({ children: true })
    this.rt.destroy(true)
    this.gradientTexture.destroy(true)
    this.displaySprite.destroy()
  }
}

// A soft white disc (alpha 1 at centre → 0 at the edge) used by every light.
// Under the `erase` blend this subtracts the matching amount of darkness, so
// the centre is fully clear and the falloff feathers the edge.
function buildGradientTexture(): Texture {
  const r = LIGHT_RADIUS_TILES * TILE_SIZE
  const size = r * 2
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
