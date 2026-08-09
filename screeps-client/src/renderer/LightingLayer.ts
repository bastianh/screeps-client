import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { ROOM_SIZE, TILE_SIZE } from './RoomRenderer.js'

/**
 * Ambient level of the light map, and the reference's own (`renderer-metadata.js`, the
 * `lighting` layer's `afterCreate`): a flat `0x808080` rectangle over the room, composited
 * with MULTIPLY, so anything unlit renders at half brightness. Lights SCREEN the map back
 * towards white; wall shadows MULTIPLY it further down.
 */
const AMBIENT = 0x808080
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
  private readonly lights = new Map<string, Sprite>()
  /** Terrain's contribution: wall shadows and lit wall faces. Owned by the caller. */
  private wallLighting: Container | null = null
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
   * Hand over the terrain's lighting contribution — wall shadow and lit wall faces, built
   * by `createWallLighting`. Pass null when the terrain layer goes away. The previous
   * container is detached but not destroyed; the terrain layer owns its lifetime.
   */
  setWallLighting(contribution: Container | null): void {
    if (this.wallLighting === contribution) return
    if (this.wallLighting && !this.wallLighting.destroyed) this.wallLighting.removeFromParent()
    this.wallLighting = contribution
    if (contribution) {
      contribution.zIndex = 1
      this.scene.addChild(contribution)
    }
    this.dirty = true
  }

  /**
   * Withdraw `contribution`, but only while it is still the active one.
   *
   * A terrain layer calls this as it is destroyed, and a room switch may already have
   * registered its successor by then — an unconditional clear would blank the new room's
   * shadows on the way out.
   */
  clearWallLighting(contribution: Container): void {
    if (this.wallLighting !== contribution) return
    this.setWallLighting(null)
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
        // Lights sit above the wall shadow so a lit wall face still reads as lit.
        sprite.blendMode = 'screen'
        sprite.zIndex = 2
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
    // Detach first: the wall contribution belongs to the terrain layer, which destroys it.
    this.setWallLighting(null)
    this.scene.destroy({ children: true })
    this.rt.destroy(true)
    this.gradientTexture.destroy(true)
    this.displaySprite.destroy()
  }
}

// A soft white disc (alpha 1 at centre → 0 at the edge) used by every light.
// Screened over the ambient grey this drives the map to white at the centre — so the
// world below is multiplied by 1 and reads at full brightness — feathering to ambient.
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
