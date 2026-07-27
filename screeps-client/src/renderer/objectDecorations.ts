import { Container, Sprite } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'
import { loadDecorationTexture } from './decorationTextures.js'
import type { DecorationAnimator } from './decorationAnimation.js'
import { creepMatchesDecoration, type CreepDecoration, type DecorationSprite, type ObjectDecoration } from './roomDecorations.js'
import type { ContainerWithTarget } from './objects/types.js'

/**
 * Attaches `creep` and `object` decorations to the display tree of a room object.
 *
 * Unlike the reference renderer there is no duplicate sprite in a lighting layer for the
 * `lighting` prop: every object here already punches a light hole around itself
 * (`RoomRenderer.updateLighting`), so an overlay on one is lit either way.
 */

/**
 * Rotation a `syncRotate` overlay needs on top of our body container.
 *
 * The artwork is drawn for the reference renderer, whose creep container faces
 * `atan2(dy, dx) + π/2` (see its `calculateAngle`) — zero means "moving up". Ours faces
 * plain `atan2(dy, dx)`, so an inherited overlay lands a quarter turn counter-clockwise.
 * The same offset also fixes a creep that has not moved yet: our body container starts at
 * `-π/2` where the reference starts at `0`.
 */
const FACING_OFFSET = Math.PI / 2

function matchesCreep(decoration: CreepDecoration, obj: RoomObject): boolean {
  if (obj.type !== 'creep' || obj.spawning === true) return false
  if (obj.user !== decoration.user) return false
  return creepMatchesDecoration(decoration, typeof obj.name === 'string' ? obj.name : '')
}

function matchesObject(decoration: ObjectDecoration, obj: RoomObject): boolean {
  if (decoration.objectType !== obj.type) return false
  // An owner-less decoration applies to every object of the type.
  return !decoration.user || obj.user === decoration.user
}

function addSprites(
  parent: Container,
  sprites: readonly DecorationSprite[],
  width: number,
  height: number,
  centred: boolean,
  flipY: boolean,
): void {
  for (const spec of sprites) {
    // The animation owns the holder's alpha outright, so the static alpha goes on the
    // sprite itself — the reverse of the graffiti layer, and what the reference does here.
    const sprite = new Sprite()
    sprite.alpha = spec.alpha
    sprite.visible = false
    parent.addChild(sprite)

    loadDecorationTexture(spec.url).then((texture) => {
      if (sprite.destroyed) return
      sprite.texture = texture
      sprite.setSize(width * TILE_SIZE, height * TILE_SIZE)
      sprite.anchor.set(0.5)
      if (centred) sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2)
      if (spec.tint != null) sprite.tint = spec.tint
      if (flipY) sprite.scale.y *= -1
      sprite.visible = true
    }).catch(() => { /* texture load failed — silently skip this graphic */ })
  }
}

/** Remove the decoration containers a previous call attached to this visual. */
export function clearObjectDecorations(visual: ContainerWithTarget): void {
  for (const container of visual.__decorations ?? []) {
    container.removeFromParent()
    container.destroy({ children: true })
  }
  visual.__decorations = undefined
}

/**
 * (Re)build the decoration overlays of one object visual. Safe to call repeatedly —
 * anything attached by an earlier call is torn down first.
 */
export function applyObjectDecorations(
  visual: ContainerWithTarget,
  obj: RoomObject,
  creeps: readonly CreepDecoration[],
  objects: readonly ObjectDecoration[],
  animator: DecorationAnimator,
): void {
  clearObjectDecorations(visual)
  visual.__decoSpawning = obj.spawning === true

  const attached: Container[] = []

  const attach = (parent: Container, below: boolean): Container => {
    const container = new Container()
    container.label = 'decoration'
    if (below) parent.addChildAt(container, 0)
    else parent.addChild(container)
    attached.push(container)
    return container
  }

  for (const decoration of creeps) {
    if (!matchesCreep(decoration, obj)) continue
    // syncRotate rides the body container, which already sits at the cell centre and
    // turns with the creep; otherwise the overlay stays upright on the visual root.
    const body = visual.__bodyContainer
    const parent = decoration.syncRotate && body ? body : visual
    const container = attach(parent, decoration.below)
    if (parent === body) container.rotation = FACING_OFFSET
    addSprites(container, decoration.sprites, decoration.width, decoration.height, parent === visual, decoration.flip)
    if (decoration.animation) animator.add(container, decoration.animation)
  }

  for (const decoration of objects) {
    if (!matchesObject(decoration, obj)) continue
    const container = attach(visual, true)
    addSprites(container, decoration.sprites, decoration.width, decoration.height, true, false)
    if (decoration.animation) animator.add(container, decoration.animation)
  }

  if (attached.length > 0) visual.__decorations = attached
}
