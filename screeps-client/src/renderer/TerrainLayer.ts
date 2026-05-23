import { Graphics, type StrokeStyle } from 'pixi.js'
import { TerrainType, RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'
import {
  TERRAIN_PLAIN, TERRAIN_ROAD, TERRAIN_BORDER,
  TERRAIN_WALL_FILL, TERRAIN_WALL_BORDER,
  TERRAIN_SWAMP_FILL, TERRAIN_SWAMP_BORDER,
} from './colors.js'

type ApplyStyle = (g: Graphics) => void

// Border widths (relative to TILE_SIZE = 12). Swamp is thicker per design.
const WALL_BORDER_W  = TILE_SIZE * 0.05
const SWAMP_BORDER_W = TILE_SIZE * 0.20

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

export function createTerrainLayer(terrain: RoomTerrain): Graphics {
  const g = new Graphics()

  // Base plain layer
  g.rect(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  g.fill(TERRAIN_PLAIN)

  // Per terrain type, two passes:
  //   Pass 1: outside-aligned stroke (border) — paints a halo around the path
  //   Pass 2: fill (inner) — covers any stroke that landed inside the connected shape,
  //           leaving only the outer halo visible as a border.
  // cap/join: 'round' — quadrant paths are open, so each ends with a stroke cap
  // at a side midpoint (top-center, left-center, …). With butt caps the strokes
  // from the two neighbouring quadrants don't quite meet, leaving 1-px notches
  // at every convex apex. Round caps/joins make them overlap cleanly.
  const swampStroke: StrokeStyle = { color: TERRAIN_SWAMP_BORDER, width: SWAMP_BORDER_W, alignment: 0, cap: 'round', join: 'round' }
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.stroke(swampStroke))
  drawTerrainQuadrants(g, terrain, TerrainType.Swamp, (gg) => gg.fill(TERRAIN_SWAMP_FILL))

  const wallStroke: StrokeStyle = { color: TERRAIN_WALL_BORDER, width: WALL_BORDER_W, alignment: 0, cap: 'round', join: 'round' }
  drawTerrainQuadrants(g, terrain, TerrainType.Wall, (gg) => gg.stroke(wallStroke))
  drawTerrainQuadrants(g, terrain, TerrainType.Wall, (gg) => gg.fill(TERRAIN_WALL_FILL))

  drawExits(g, terrain)

  // Room border
  g.rect(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  g.stroke({ width: 1, color: TERRAIN_BORDER })

  return g
}
