import { AlphaFilter, Container, Graphics, BlurFilter, NoiseFilter, Rectangle, Sprite, TilingSprite, type DestroyOptions, type Renderer, type StrokeStyle } from 'pixi.js'
import { TerrainType, RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'
import { loadDecorationTexture } from './decorationTextures.js'
import { REFERENCE_CELL_SIZE } from './roomDecorations.js'
import {
  TERRAIN_PLAIN, TERRAIN_ROAD, TERRAIN_BORDER,
  TERRAIN_WALL_FILL, TERRAIN_WALL_BORDER, TERRAIN_WALL_NOISE,
  TERRAIN_SWAMP_FILL, TERRAIN_SWAMP_BORDER, TERRAIN_SWAMP_TEXTURE,
} from './colors.js'

/**
 * A length the reference renderer expresses in its own units — `CELL_SIZE` 100 per tile,
 * `VIEW_BOX` 5000 per room — converted to ours. Tile scales come across raw, so a
 * decoration authored against the official client tiles at the same density here.
 */
const REFERENCE_SCALE = TILE_SIZE / REFERENCE_CELL_SIZE

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
  /** Wall noise overlay color */
  wallNoiseColor?: number
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
  wallNoiseColor: number
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
    wallNoiseColor:   d?.wallNoiseColor   ?? TERRAIN_WALL_NOISE,
  }
}

type ApplyStyle = (g: Graphics) => void

// Walks every quadrant of every tile of `targetType` and calls `apply(g)`
// after each sub-path. Used to apply either a stroke (border pass) or fill
// (inner pass) to the same shape geometry.
function drawTerrainQuadrants(
  g: Graphics,
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

function drawExits(g: Graphics, terrain: RoomTerrain) {
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
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.stroke(swampStroke))
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.fill(colors.swampFillColor))
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
  drawTerrainQuadrants(g, terrain, TerrainType.Wall, (gg) => gg.stroke(wallStroke))
  drawTerrainQuadrants(g, terrain, TerrainType.Wall, (gg) => gg.fill(colors.wallFillColor))
  drawExits(g, terrain)
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
function createSwampTexture(terrain: RoomTerrain, renderer: Renderer): Container {
  const W = 50 * TILE_SIZE
  const cloud = new Graphics()
  cloud.rect(0, 0, W, W)
  cloud.fill(0x808080)
  cloud.filters = [new NoiseFilter({ noise: 0.9, seed: 2 }), new BlurFilter({ strength: 6, quality: 3 })]
  cloud.filterArea = new Rectangle(0, 0, W, W)

  const texture = renderer.generateTexture({ target: cloud, frame: cloud.filterArea })
  cloud.filters = null
  cloud.destroy()

  const sprite = new Sprite(texture)
  sprite.tint = TERRAIN_SWAMP_TEXTURE
  sprite.blendMode = 'add'
  sprite.alpha = 0.15

  const mask = new Graphics()
  drawTerrainQuadrants(mask, terrain, TerrainType.Swamp, (g) => g.fill(0xffffff))
  sprite.mask = mask

  const container = new Container()
  container.label = 'swampTexture'
  container.addChild(mask, sprite)
  return container
}

function createWallNoise(terrain: RoomTerrain, renderer: Renderer, colors: ResolvedColors): Sprite {
  const g = new Graphics()
  drawTerrainQuadrants(g, terrain, TerrainType.Wall, (gg) => gg.fill(colors.wallNoiseColor))
  g.alpha = 0.5
  g.filters = [new NoiseFilter({ noise: 0.12, seed: 1 })]
  g.filterArea = new Rectangle(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)

  const texture = renderer.generateTexture({
    target: g,
    frame: g.filterArea,
  })

  g.filters = null
  g.destroy()

  const sprite = new Sprite(texture)
  sprite.label = 'wallNoise'
  return sprite
}

/**
 * Graphics covering exactly the wall tiles. Used as a mask for wall-only overlays —
 * the landscape wall texture here, and wallGraffiti in the decoration layer.
 * A Graphics can only mask one object, so every consumer needs its own instance.
 */
export function createWallMask(terrain: RoomTerrain): Graphics {
  const mask = new Graphics()
  drawTerrainQuadrants(mask, terrain, TerrainType.Wall, (g) => g.fill(0xffffff))
  return mask
}

export function createTerrainLayer(terrain: RoomTerrain, renderer: Renderer, decoration?: TerrainDecoration): Container {
  const colors = resolveColors(decoration)
  const container = new Container()
  const wallNoise = createWallNoise(terrain, renderer, colors)
  const swampTexture = createSwampTexture(terrain, renderer)
  const baseDestroy = container.destroy.bind(container)

  container.destroy = (options?: DestroyOptions) => {
    for (const generated of [wallNoise, swampTexture.getChildAt<Sprite>(1)]) {
      if (generated.destroyed) continue
      generated.removeFromParent()
      generated.destroy({ texture: true, textureSource: true })
    }
    baseDestroy(options)
  }

  container.addChild(createFloorBase(colors))           // index 0: plain floor colour
  container.addChild(createSwampShapes(terrain, colors)) // index 1: swamp border + fill at alpha 0.4
  container.addChild(createWallShapes(terrain, colors))  // index 2: wall fills + borders + exits + room border
  container.addChild(swampTexture)                       // index 3
  container.addChild(wallNoise)                          // index 4

  const W = 50 * TILE_SIZE

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
      const maskG = createWallMask(terrain)
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
