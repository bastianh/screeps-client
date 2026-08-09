import { AlphaFilter, Container, Graphics, GraphicsContext, BlurFilter, Rectangle, Sprite, Texture, TilingSprite, type DestroyOptions, type StrokeStyle } from 'pixi.js'
import { TerrainType, RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'
import type { LightingLayer } from './LightingLayer.js'
import { loadDecorationTexture } from './decorationTextures.js'
import { REFERENCE_CELL_SIZE } from './roomDecorations.js'
import {
  TERRAIN_PLAIN, TERRAIN_ROAD, TERRAIN_BORDER,
  TERRAIN_WALL_FILL, TERRAIN_WALL_BORDER,
  TERRAIN_SWAMP_FILL, TERRAIN_SWAMP_BORDER, TERRAIN_SWAMP_TEXTURE,
} from './colors.js'

/**
 * A length the reference renderer expresses in its own units — `CELL_SIZE` 100 per tile,
 * `VIEW_BOX` 5000 per room — converted to ours. Tile scales come across raw, so a
 * decoration authored against the official client tiles at the same density here.
 */
const REFERENCE_SCALE = TILE_SIZE / REFERENCE_CELL_SIZE

const ROOM_EXTENT = 50 * TILE_SIZE

/** Blur radius of the wall shadow — the reference's `WALLS_BLUR * size.width`. */
const WALLS_BLUR = 0.006

/** Grey the reference paints wall faces at in the light map, so walls read lit. */
const WALL_LIGHTING = 0x808080

/**
 * Soft grey cloud standing in for one of the reference's greyscale texture assets.
 *
 * `noise1`, `noise2`, `ground` and `ground-mask` are all blurry greyscale tiles, differing
 * mainly in how many blobs span a room and in tonal range — `ground-mask` is near-white,
 * `ground` mid-dark. We ship none of them, so each is generated at its blob resolution
 * (one texel per blob) and stretched over the room, letting bilinear filtering smooth it.
 */
function cloudTexture(cells: number, min: number, range: number): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = cells
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(cells, cells)
  for (let i = 0; i < cells * cells; i++) {
    const v = min + Math.round(Math.random() * range)
    image.data.set([v, v, v, 255], i * 4)
  }
  ctx.putImageData(image, 0, 0)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'linear'
  return texture
}

// Built once and shared by every room: regenerating per room would burn a canvas upload
// for a texture nobody can tell apart from the last one.
const clouds = new Map<string, Texture>()

function cloud(key: string, cells: number, min: number, range: number): Texture {
  let texture = clouds.get(key)
  if (!texture) {
    texture = cloudTexture(cells, min, range)
    clouds.set(key, texture)
  }
  return texture
}

/** Room-sized cloud sprite. `mask` limits it to one terrain type; omit to cover the room. */
function cloudSprite(texture: Texture, alpha: number, blend: 'add' | 'normal' | 'multiply'): Sprite {
  const sprite = new Sprite(texture)
  sprite.setSize(ROOM_EXTENT, ROOM_EXTENT)
  sprite.alpha = alpha
  sprite.blendMode = blend
  return sprite
}

function maskedCloud(mask: Graphics, texture: Texture, alpha: number, tint?: number): Container {
  const sprite = cloudSprite(texture, alpha, 'add')
  if (tint != null) sprite.tint = tint
  sprite.mask = mask

  const container = new Container()
  container.addChild(mask, sprite)
  return container
}

/**
 * The reference's undecorated ground, i.e. the `else` of its floor branch: a `ground` tile
 * at alpha 0.3 over the floor colour and a near-white `ground-mask` multiplied at 0.15.
 *
 * Subtle mottling rather than a brightness change — but without it a plain room is a flat
 * field of one colour, which is most of why ours read as deader than the official's. A
 * floor landscape replaces both with its own artwork, so this is skipped there.
 */
function createGroundTexture(): Container {
  const container = new Container()
  container.label = 'groundTexture'
  container.addChild(
    cloudSprite(cloud('ground', 12, 55, 45), 0.3, 'normal'),
    cloudSprite(cloud('groundMask', 6, 215, 40), 0.15, 'multiply'),
  )
  return container
}

export interface TerrainDecoration {
  /** Floor background color (replaces plain ground color) */
  floorColor?: number
  /** Swamp fill color */
  swampFillColor?: number
  /** Swamp border color */
  swampBorderColor?: number
  /** Swamp border width as a fraction of TILE_SIZE (default 0.25) */
  swampBorderWidth?: number
  /** Wall fill color */
  wallFillColor?: number
  /** Wall border color */
  wallBorderColor?: number
  /** Wall border width as a fraction of TILE_SIZE (default 0.05) */
  wallBorderWidth?: number
  /** `strokeLighting`, 0–1: how brightly the wall rim reads in the light map */
  wallBorderLighting?: number
  /** URL for the floor texture overlay (floorLandscape foreground) */
  floorTextureUrl?: string
  /** Tint color for the floor texture */
  floorTextureTint?: number
  /** Alpha for the floor texture (0–1) */
  floorTextureAlpha?: number
  /**
   * Tile scale in reference units, or undefined to stretch one copy over the room.
   * Only definitions that declare `tileScale` tile — see `landscapeTileScale`.
   */
  floorTextureTileScale?: number
  /**
   * URL for the wall texture overlay (wallLandscape foreground), masked to wall shape.
   * Always stretched: the reference never tiles this half, whatever `tileScale` says.
   */
  wallTextureUrl?: string
  /** Tint color for the wall texture */
  wallTextureTint?: number
  /** Alpha for the wall texture (0–1) */
  wallTextureAlpha?: number
}

interface ResolvedColors {
  floorColor: number
  swampFillColor: number
  swampBorderColor: number
  swampBorderWidth: number
  wallFillColor: number
  wallBorderColor: number
  wallBorderWidth: number
}

// The two border defaults are the reference's own undecorated widths run through the same
// conversion a decoration gets: `swampStrokeWidth` 50 and `strokeWidth` 10, halved because
// `paint-order: stroke` hides the inner half, over 100 units per tile.
function resolveColors(d?: TerrainDecoration): ResolvedColors {
  return {
    floorColor:       d?.floorColor       ?? TERRAIN_PLAIN,
    swampFillColor:   d?.swampFillColor   ?? TERRAIN_SWAMP_FILL,
    swampBorderColor: d?.swampBorderColor ?? TERRAIN_SWAMP_BORDER,
    swampBorderWidth: d?.swampBorderWidth ?? 0.25,
    wallFillColor:    d?.wallFillColor    ?? TERRAIN_WALL_FILL,
    wallBorderColor:  d?.wallBorderColor  ?? TERRAIN_WALL_BORDER,
    wallBorderWidth:  d?.wallBorderWidth  ?? 0.05,
  }
}

type ApplyStyle = (g: GraphicsContext) => void

// Walks every quadrant of every tile of `targetType` and calls `apply(g)`
// after each sub-path. Used to apply either a stroke (border pass) or fill
// (inner pass) to the same shape geometry.
//
// Takes the GraphicsContext rather than the Graphics so callers that only need the raw
// shape can share one context between several Graphics — see `terrainShape`.
function drawTerrainQuadrants(
  g: GraphicsContext,
  terrain: RoomTerrain,
  targetType: TerrainType,
  apply: ApplyStyle,
) {
  const T = TILE_SIZE
  const R = T / 2
  let pathDrawn = false

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const center = terrain.get(x, y) === targetType
      const top    = y > 0  && terrain.get(x, y - 1) === targetType
      const bottom = y < 49 && terrain.get(x, y + 1) === targetType
      const left   = x > 0  && terrain.get(x - 1, y) === targetType
      const right  = x < 49 && terrain.get(x + 1, y) === targetType

      const cx = x * T + R
      const cy = y * T + R

      // Top-Left Quadrant
      if (center) {
        pathDrawn = true
        if (!top && !left && y > 0 && x > 0) {
          g.moveTo(cx, y * T)
          g.arc(cx, cy, R, -Math.PI / 2, Math.PI, true)
          g.lineTo(cx, cy)
          g.closePath()
        } else {
          g.rect(x * T, y * T, R, R)
        }
      } else {
        if (top && left && terrain.get(x - 1, y - 1) === targetType) {
          pathDrawn = true
          g.moveTo(cx, y * T)
          g.lineTo(x * T, y * T)
          g.lineTo(x * T, cy)
          g.arc(cx, cy, R, Math.PI, -Math.PI / 2, false)
          g.closePath()
        }
      }

      // Top-Right Quadrant
      if (center) {
        if (!top && !right && y > 0 && x < 49) {
          g.moveTo(cx, y * T)
          g.arc(cx, cy, R, -Math.PI / 2, 0, false)
          g.lineTo(cx, cy)
          g.closePath()
        } else {
          g.rect(cx, y * T, R, R)
        }
      } else {
        if (top && right && terrain.get(x + 1, y - 1) === targetType) {
          pathDrawn = true
          g.moveTo(cx, y * T)
          g.lineTo(x * T + T, y * T)
          g.lineTo(x * T + T, cy)
          g.arc(cx, cy, R, 0, -Math.PI / 2, true)
          g.closePath()
        }
      }

      // Bottom-Left Quadrant
      if (center) {
        if (!bottom && !left && y < 49 && x > 0) {
          g.moveTo(x * T, cy)
          g.arc(cx, cy, R, Math.PI, Math.PI / 2, true)
          g.lineTo(cx, cy)
          g.closePath()
        } else {
          g.rect(x * T, cy, R, R)
        }
      } else {
        if (bottom && left && terrain.get(x - 1, y + 1) === targetType) {
          pathDrawn = true
          g.moveTo(x * T, cy)
          g.lineTo(x * T, y * T + T)
          g.lineTo(cx, y * T + T)
          g.arc(cx, cy, R, Math.PI / 2, Math.PI, false)
          g.closePath()
        }
      }

      // Bottom-Right Quadrant
      if (center) {
        if (!bottom && !right && y < 49 && x < 49) {
          g.moveTo(cx, y * T + T)
          g.arc(cx, cy, R, Math.PI / 2, 0, true)
          g.lineTo(cx, cy)
          g.closePath()
        } else {
          g.rect(cx, cy, R, R)
        }
      } else {
        if (bottom && right && terrain.get(x + 1, y + 1) === targetType) {
          pathDrawn = true
          g.moveTo(cx, y * T + T)
          g.lineTo(x * T + T, y * T + T)
          g.lineTo(x * T + T, cy)
          g.arc(cx, cy, R, 0, Math.PI / 2, false)
          g.closePath()
        }
      }
    }
  }
  // Only apply stroke/fill if at least one path element was drawn.
  // Calling fill()/stroke() on an empty path in PixiJS 8 can re-apply the
  // style to the previous path (the base plain rect), painting rooms that
  // have no swamp/wall tiles with the wrong color.
  if (pathDrawn) apply(g)
}

/**
 * White-filled path of one terrain type, shared by everything that needs the raw shape —
 * the wall and swamp masks, the wall shadow, the lit wall face.
 *
 * Sharing the GraphicsContext shares its tessellation, so the 2500-tile walk that
 * dominates layer construction runs twice per room instead of six times. The cache holds
 * one room: entering a room builds the terrain layer, then builds it again a moment later
 * when the decorations arrive over their own request, and that second pass is the one the
 * eye catches. Keyed on the RoomTerrain instance, so the rebuild is a straight hit.
 */
let shapeCache: { terrain: RoomTerrain; wall: GraphicsContext; swamp: GraphicsContext } | null = null

function terrainShape(terrain: RoomTerrain, type: TerrainType.Wall | TerrainType.Swamp): GraphicsContext {
  if (shapeCache?.terrain !== terrain) {
    shapeCache?.wall.destroy()
    shapeCache?.swamp.destroy()
    const build = (t: TerrainType) => {
      const context = new GraphicsContext()
      drawTerrainQuadrants(context, terrain, t, (c) => c.fill(0xffffff))
      return context
    }
    shapeCache = { terrain, wall: build(TerrainType.Wall), swamp: build(TerrainType.Swamp) }
  }
  return type === TerrainType.Wall ? shapeCache.wall : shapeCache.swamp
}

/**
 * A Graphics over a shared shape context. Never destroy one with `{ context: true }` —
 * the context outlives it, and the other consumers of the same shape are still using it.
 */
function shapeGraphics(terrain: RoomTerrain, type: TerrainType.Wall | TerrainType.Swamp, tint?: number): Graphics {
  const g = new Graphics(terrainShape(terrain, type))
  if (tint != null) g.tint = tint
  return g
}

function drawExits(g: GraphicsContext, terrain: RoomTerrain) {
  const exitColor = TERRAIN_ROAD
  const T = TILE_SIZE

  const drawArrow = (x: number, y: number, dir: 'up' | 'down' | 'left' | 'right') => {
    const cx = x * T + T / 2
    const cy = y * T + T / 2
    const size = T * 0.3

    if (dir === 'up') {
      g.moveTo(cx, cy - size)
      g.lineTo(cx + size, cy + size)
      g.lineTo(cx - size, cy + size)
    } else if (dir === 'down') {
      g.moveTo(cx, cy + size)
      g.lineTo(cx + size, cy - size)
      g.lineTo(cx - size, cy - size)
    } else if (dir === 'left') {
      g.moveTo(cx - size, cy)
      g.lineTo(cx + size, cy - size)
      g.lineTo(cx + size, cy + size)
    } else if (dir === 'right') {
      g.moveTo(cx + size, cy)
      g.lineTo(cx - size, cy - size)
      g.lineTo(cx - size, cy + size)
    }

    g.fill(exitColor)
  }

  for (let x = 0; x < 50; x++) {
    if (terrain.get(x, 0)  !== TerrainType.Wall) drawArrow(x, 0,  'up')
    if (terrain.get(x, 49) !== TerrainType.Wall) drawArrow(x, 49, 'down')
  }
  for (let y = 0; y < 50; y++) {
    if (terrain.get(0,  y) !== TerrainType.Wall) drawArrow(0,  y, 'left')
    if (terrain.get(49, y) !== TerrainType.Wall) drawArrow(49, y, 'right')
  }
}

function createFloorBase(colors: ResolvedColors): Graphics {
  const g = new Graphics()
  g.rect(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  g.fill(colors.floorColor)
  return g
}

// Two passes per terrain type:
//   Pass 1: outside-aligned stroke (border) — paints a halo around the path
//   Pass 2: fill (inner) — covers any stroke that landed inside the shape,
//           leaving only the outer halo visible as a border.
// cap/join: 'round' — quadrant paths are open so each ends with a stroke cap at a
// side midpoint. Butt caps leave 1-px notches at convex apexes; round caps overlap cleanly.

function createSwampShapes(terrain: RoomTerrain, colors: ResolvedColors): Graphics {
  const g = new Graphics()
  const swampStroke: StrokeStyle = { color: colors.swampBorderColor, width: TILE_SIZE * colors.swampBorderWidth, alignment: 0, cap: 'round', join: 'round' }
  drawTerrainQuadrants(g.context, terrain, TerrainType.Swamp, (gg) => gg.stroke(swampStroke))
  drawTerrainQuadrants(g.context, terrain, TerrainType.Swamp, (gg) => gg.fill(colors.swampFillColor))
  // Fade via AlphaFilter, not `g.alpha`: plain alpha is applied per-vertex, so the
  // translucent fill blends with the border strokes underneath instead of covering
  // them — every quadrant sub-path gets outlined and the seams show through as a grid.
  // The filter fades the shape as a whole, like the reference renderer's flattened
  // SVG sprite. Walls don't need this; their fill is opaque and hides the inner strokes.
  g.filters = [new AlphaFilter({ alpha: 0.4 })]
  g.filterArea = new Rectangle(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  return g
}

function createWallShapes(terrain: RoomTerrain, colors: ResolvedColors): Graphics {
  const g = new Graphics()
  const wallStroke: StrokeStyle = { color: colors.wallBorderColor, width: TILE_SIZE * colors.wallBorderWidth, alignment: 0, cap: 'round', join: 'round' }
  drawTerrainQuadrants(g.context, terrain, TerrainType.Wall, (gg) => gg.stroke(wallStroke))
  drawTerrainQuadrants(g.context, terrain, TerrainType.Wall, (gg) => gg.fill(colors.wallFillColor))
  drawExits(g.context, terrain)
  g.rect(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  g.stroke({ width: 1, color: TERRAIN_BORDER })
  return g
}

/**
 * The reference's swamp texture: an additive green cloud masked to the swamp shape.
 *
 * It stacks two `noise2` TilingSprites (`BLEND_MODES.ADD`, tint `0x66FF00`, alpha 0.3)
 * behind masks drawn at alpha 0.25, so each contributes 0.075 — combined here into one
 * layer at 0.15. We ship no `noise2` asset, so the cloud is generated: white noise blurred
 * into low-frequency blobs, roughly the scale the reference's `tileScale` 10 gives it.
 *
 * Crucially the tint is fixed, exactly as in the reference — this layer is not
 * decoration-driven, so a pack's `swampColor` still reads as its own colour underneath.
 */
function createSwampTexture(terrain: RoomTerrain): Container {
  const mask = shapeGraphics(terrain, TerrainType.Swamp)
  const container = maskedCloud(mask, cloud('swamp', 12, 90, 110), 0.15, TERRAIN_SWAMP_TEXTURE)
  container.label = 'swampTexture'
  return container
}

/**
 * The reference's wall bump: `noise1` masked to the walls, alpha 0.2, `BLEND_MODES.ADD`,
 * baked into the wall texture whenever lighting is not disabled.
 *
 * It *adds* to whatever colour the wall already has. The flat grey wash this replaced
 * overwrote it instead, which pulled a decorated wall towards neutral and cost the
 * landscape its colour.
 */
function createWallNoise(terrain: RoomTerrain): Container {
  const container = maskedCloud(shapeGraphics(terrain, TerrainType.Wall), cloud('wall', 12, 90, 110), 0.2)
  container.label = 'wallNoise'
  return container
}

/**
 * The terrain's contribution to the light map, for `LightingLayer.setWallLighting`.
 *
 * Mirrors the reference's two lighting-layer wall objects: a blurred black silhouette,
 * which is the soft shadow walls cast onto the floor, and the wall shape screened back to
 * `WALL_LIGHTING` so wall faces read as lit rather than shadowed. The rim is screened at
 * the decoration's `strokeLighting` — 0 leaves it in shadow, 1 makes it glow.
 *
 * Returned as plain display objects for the light map to bake. They must not stay live in
 * it: that scene re-renders on every frame a creep moves, and a blurred full-room path is
 * far too expensive to re-tessellate at that rate.
 */
export function createWallLighting(
  terrain: RoomTerrain,
  decoration?: TerrainDecoration,
): { shadow: Container; lit: Container } {
  const colors = resolveColors(decoration)

  const shadow = shapeGraphics(terrain, TerrainType.Wall, 0x000000)
  shadow.filters = [new BlurFilter({ strength: ROOM_EXTENT * WALLS_BLUR, quality: 3 })]
  shadow.filterArea = new Rectangle(0, 0, ROOM_EXTENT, ROOM_EXTENT)

  // The rim is its own Graphics so the face can keep sharing the cached wall shape. Drawn
  // first, so the face covers the half of the outside-aligned stroke that lands inside.
  const glow = Math.round(255 * (decoration?.wallBorderLighting ?? 0))
  const rim = new Graphics()
  drawTerrainQuadrants(rim.context, terrain, TerrainType.Wall, (g) => g.stroke({
    color: (glow << 16) | (glow << 8) | glow,
    width: TILE_SIZE * colors.wallBorderWidth,
    alignment: 0, cap: 'round', join: 'round',
  }))

  const lit = new Container()
  lit.addChild(rim, shapeGraphics(terrain, TerrainType.Wall, WALL_LIGHTING))

  return { shadow, lit }
}

/**
 * Graphics covering exactly the wall tiles. Used as a mask for wall-only overlays —
 * the landscape wall texture here, and wallGraffiti in the decoration layer.
 * A Graphics can only mask one object, so every consumer needs its own instance.
 */
export function createWallMask(terrain: RoomTerrain): Graphics {
  // Deliberately its own geometry, not the shared shape context. DecorationLayer holds one
  // of these and is torn down on its own schedule, which can outlast the terrain layer
  // that owns the cache entry — a shared context could be freed out from under it.
  const mask = new Graphics()
  drawTerrainQuadrants(mask.context, terrain, TerrainType.Wall, (g) => g.fill(0xffffff))
  return mask
}

/**
 * Build the room's terrain.
 *
 * `lighting` is optional only so tests and the map path can skip it; when given, the layer
 * registers its wall shadow with the light map and withdraws it again on destroy, so the
 * two never disagree about which room's walls are casting.
 */
export function createTerrainLayer(
  terrain: RoomTerrain,
  decoration?: TerrainDecoration,
  lighting?: LightingLayer,
): Container {
  const colors = resolveColors(decoration)
  const container = new Container()
  const baseDestroy = container.destroy.bind(container)
  const generation = lighting?.setWallLighting(createWallLighting(terrain, decoration))

  container.destroy = (options?: DestroyOptions) => {
    if (generation != null) lighting?.clearWallLighting(generation)
    baseDestroy(options)
  }

  container.addChild(createFloorBase(colors))            // index 0: plain floor colour
  // The reference's floor is one branch or the other, never both: its own ground tiles, or
  // a landscape's artwork loaded below. Index 1 either way, so the swamp still blends over.
  if (!decoration?.floorTextureUrl) container.addChild(createGroundTexture())
  container.addChild(createSwampShapes(terrain, colors)) // swamp border + fill at alpha 0.4
  container.addChild(createWallShapes(terrain, colors))  // wall fills + borders + exits + room border
  container.addChild(createSwampTexture(terrain))
  container.addChild(createWallNoise(terrain))

  const W = ROOM_EXTENT

  // Both halves mirror the reference: the floor tiles only when the *definition* declared a
  // tileScale, the wall never does — it is always one plain sprite stretched over the room.
  if (decoration?.floorTextureUrl) {
    const { floorTextureUrl, floorTextureTint = 0xffffff, floorTextureAlpha = 1, floorTextureTileScale } = decoration
    loadDecorationTexture(floorTextureUrl).then((texture) => {
      if (container.destroyed) return
      let sprite: Sprite | TilingSprite
      if (floorTextureTileScale != null) {
        sprite = new TilingSprite({ texture, width: W, height: W })
        sprite.tileScale.set(floorTextureTileScale * REFERENCE_SCALE)
      } else {
        sprite = new Sprite(texture)
        sprite.setSize(W, W)
      }
      sprite.tint = floorTextureTint
      sprite.alpha = floorTextureAlpha
      // Insert between floor base (0) and swamp shapes (1): swamp at alpha 0.4 blends over the texture
      container.addChildAt(sprite, 1)
    }).catch(() => { /* texture load failed — silently skip */ })
  }

  if (decoration?.wallTextureUrl) {
    const { wallTextureUrl, wallTextureTint = 0xffffff, wallTextureAlpha = 1 } = decoration
    loadDecorationTexture(wallTextureUrl).then((texture) => {
      if (container.destroyed) return
      const sprite = new Sprite(texture)
      sprite.setSize(W, W)
      sprite.tint = wallTextureTint
      sprite.alpha = wallTextureAlpha
      const maskG = shapeGraphics(terrain, TerrainType.Wall)
      container.addChild(maskG)
      sprite.mask = maskG
      container.addChild(sprite)
    }).catch(() => { /* texture load failed — silently skip */ })
  }

  return container
}

export function setTerrainEffectsVisible(layer: Container, visible: boolean): void {
  layer.getChildByLabel('swampTexture')!.visible = visible
  layer.getChildByLabel('wallNoise')!.visible = visible
}
