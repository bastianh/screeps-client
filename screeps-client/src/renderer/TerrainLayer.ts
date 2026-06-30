import { Assets, Container, Graphics, BlurFilter, NoiseFilter, Rectangle, Sprite, TilingSprite, type DestroyOptions, type Renderer, type StrokeStyle } from 'pixi.js'
import { TerrainType, RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'
import {
  TERRAIN_PLAIN, TERRAIN_ROAD, TERRAIN_BORDER,
  TERRAIN_WALL_FILL, TERRAIN_WALL_BORDER, TERRAIN_WALL_NOISE,
  TERRAIN_SWAMP_FILL, TERRAIN_SWAMP_BORDER, TERRAIN_SWAMP_GLOW,
} from './colors.js'

// In dev, route Screeps S3 decoration textures through the Vite proxy to avoid CORS.
function devProxyUrl(url: string): string {
  if (import.meta.env.DEV && url.startsWith('https://s3.amazonaws.com/')) {
    return url.replace('https://s3.amazonaws.com', '/__screeps_s3__')
  }
  return url
}

export interface TerrainDecoration {
  /** Floor background color (replaces plain ground color) */
  floorColor?: number
  /** Swamp fill color */
  swampFillColor?: number
  /** Swamp border color */
  swampBorderColor?: number
  /** Swamp border width as a fraction of TILE_SIZE (default 0.20) */
  swampBorderWidth?: number
  /** Color of the soft swamp glow blur layer */
  swampGlowColor?: number
  /** Wall fill color */
  wallFillColor?: number
  /** Wall border color */
  wallBorderColor?: number
  /** Wall border width as a fraction of TILE_SIZE (default 0.05) */
  wallBorderWidth?: number
  /** Wall noise overlay color */
  wallNoiseColor?: number
  /** URL for a tiling floor texture overlay (floorLandscape foreground) */
  floorTextureUrl?: string
  /** Tint color for the floor texture */
  floorTextureTint?: number
  /** Alpha for the floor texture (0–1) */
  floorTextureAlpha?: number
  /** Tile scale for the floor texture (default 1) */
  floorTextureTileScale?: number
  /** URL for a tiling wall texture overlay (wallLandscape foreground), masked to wall shape */
  wallTextureUrl?: string
  /** Tint color for the wall texture */
  wallTextureTint?: number
  /** Alpha for the wall texture (0–1) */
  wallTextureAlpha?: number
  /** Tile scale for the wall texture (default 1) */
  wallTextureTileScale?: number
}

interface ResolvedColors {
  floorColor: number
  swampFillColor: number
  swampBorderColor: number
  swampBorderWidth: number
  swampGlowColor: number
  wallFillColor: number
  wallBorderColor: number
  wallBorderWidth: number
  wallNoiseColor: number
}

function resolveColors(d?: TerrainDecoration): ResolvedColors {
  return {
    floorColor:       d?.floorColor       ?? TERRAIN_PLAIN,
    swampFillColor:   d?.swampFillColor   ?? TERRAIN_SWAMP_FILL,
    swampBorderColor: d?.swampBorderColor ?? TERRAIN_SWAMP_BORDER,
    swampBorderWidth: d?.swampBorderWidth ?? 0.20,
    swampGlowColor:   d?.swampGlowColor   ?? TERRAIN_SWAMP_GLOW,
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
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.fill(colors.swampFillColor))
  g.alpha = 0.4
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

function createSwampGlow(terrain: RoomTerrain, colors: ResolvedColors): Graphics {
  const g = new Graphics()
  g.label = 'swampGlow'
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.fill(colors.swampGlowColor))
  g.alpha = 0.45
  g.filters = [new BlurFilter({ strength: 5, quality: 3 })]
  return g
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

export function createTerrainLayer(terrain: RoomTerrain, renderer: Renderer, decoration?: TerrainDecoration): Container {
  const colors = resolveColors(decoration)
  const container = new Container()
  const wallNoise = createWallNoise(terrain, renderer, colors)
  const baseDestroy = container.destroy.bind(container)

  container.destroy = (options?: DestroyOptions) => {
    if (!wallNoise.destroyed) {
      wallNoise.removeFromParent()
      wallNoise.destroy({ texture: true, textureSource: true })
    }
    baseDestroy(options)
  }

  container.addChild(createFloorBase(colors))           // index 0: plain floor colour
  container.addChild(createSwampShapes(terrain, colors)) // index 1: swamp fill at alpha 0.4 (fill only, no stroke)
  container.addChild(createWallShapes(terrain, colors))  // index 2: wall fills + borders + exits + room border
  container.addChild(createSwampGlow(terrain, colors))   // index 3
  container.addChild(wallNoise)                          // index 4

  if (decoration?.wallTextureUrl) wallNoise.visible = false

  const W = 50 * TILE_SIZE

  if (decoration?.floorTextureUrl) {
    const { floorTextureUrl, floorTextureTint = 0xffffff, floorTextureAlpha = 1, floorTextureTileScale = 1 } = decoration
    Assets.load(devProxyUrl(floorTextureUrl)).then((texture) => {
      if (container.destroyed) return
      const sprite = new TilingSprite({ texture, width: W, height: W })
      sprite.tint = floorTextureTint
      sprite.alpha = floorTextureAlpha
      sprite.tileScale.set(floorTextureTileScale * 0.8)
      // Insert between floor base (0) and swamp shapes (1): swamp at alpha 0.4 blends over the texture
      container.addChildAt(sprite, 1)
    }).catch(() => { /* texture load failed — silently skip */ })
  }

  if (decoration?.wallTextureUrl) {
    const { wallTextureUrl, wallTextureTint = 0xffffff, wallTextureAlpha = 1, wallTextureTileScale = 1 } = decoration
    Assets.load(devProxyUrl(wallTextureUrl)).then((texture) => {
      if (container.destroyed) return
      const sprite = new TilingSprite({ texture, width: W, height: W })
      sprite.tint = wallTextureTint
      sprite.alpha = wallTextureAlpha
      sprite.tileScale.set(wallTextureTileScale)
      const maskG = new Graphics()
      drawTerrainQuadrants(maskG, terrain, TerrainType.Wall, (gg) => gg.fill(0xffffff))
      container.addChild(maskG)
      sprite.mask = maskG
      container.addChild(sprite)
    }).catch(() => { /* texture load failed — silently skip */ })
  }

  return container
}

export function setTerrainEffectsVisible(layer: Container, visible: boolean): void {
  layer.getChildByLabel('swampGlow')!.visible = visible
  layer.getChildByLabel('wallNoise')!.visible = visible
}
