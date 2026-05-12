import { describe, it, expect } from 'vitest'
import { RoomTerrain, TerrainType } from '../../src/types/game.js'

describe('RoomTerrain', () => {
  it('parses plain, wall, swamp from encoded string', () => {
    const encoded = '012' + '0'.repeat(2497)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
    expect(terrain.get(1, 0)).toBe(TerrainType.Wall)
    expect(terrain.get(2, 0)).toBe(TerrainType.Swamp)
  })

  it('normalizes value 3 to Wall', () => {
    const encoded = '3' + '0'.repeat(2499)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    expect(terrain.get(0, 0)).toBe(TerrainType.Wall)
  })

  it('maps (x, y) to index y*50+x', () => {
    // tile at x=0, y=1 is index 50
    const chars = Array(2500).fill('0')
    chars[50] = '1'
    const terrain = RoomTerrain.fromEncodedString(chars.join(''))
    expect(terrain.get(0, 1)).toBe(TerrainType.Wall)
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
  })

  it('exposes raw Uint8Array of length 2500', () => {
    const terrain = RoomTerrain.fromEncodedString('0'.repeat(2500))
    expect(terrain.raw).toBeInstanceOf(Uint8Array)
    expect(terrain.raw.length).toBe(2500)
  })

  it('round-trips through raw bytes', () => {
    const encoded = '012' + '0'.repeat(2497)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    const restored = new RoomTerrain(terrain.raw)
    expect(restored.get(0, 0)).toBe(TerrainType.Plain)
    expect(restored.get(1, 0)).toBe(TerrainType.Wall)
    expect(restored.get(2, 0)).toBe(TerrainType.Swamp)
  })
})
