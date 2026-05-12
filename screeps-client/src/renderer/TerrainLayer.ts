import { Graphics } from 'pixi.js'
import { TerrainType, RoomTerrain } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Plain]: 0x2d333b,
  [TerrainType.Wall]: 0x0d1117,
  [TerrainType.Swamp]: 0x3d5a3d,
}

export function createTerrainLayer(terrain: RoomTerrain): Graphics {
  const g = new Graphics()

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const type = terrain.get(x, y)
      const color = TERRAIN_COLORS[type] ?? 0x2d333b
      g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      g.fill(color)
    }
  }

  // Room border
  g.rect(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE)
  g.stroke({ width: 1, color: 0x30363d })

  return g
}
