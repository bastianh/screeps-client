import { describe, it, expect } from 'vitest'
import type { MapRoomDecorations } from 'screeps-connectivity'
import { buildMapDecoration } from '../../src/renderer/mapDecorations'

// Values taken from the live decorations in ROOM_DECORATIONS_MOCK, run through the
// reference map layer's own maths (@screeps/map layers/decorations).
const floor = {
  backgroundColor: '#F67BFF',
  backgroundBrightness: 0.98,
  swampColor: '#4073A3',
  roadsColor: '#E9A7EE',
  foregroundUrl: 'floor.png',
  foregroundColor: '#F67BFF',
  foregroundBrightness: 0.42,
  foregroundAlpha: 0.87,
}

const wall = {
  backgroundColor: '#5261A0',
  backgroundBrightness: 1,
  foregroundUrl: 'wall.png',
  foregroundColor: '#6A88FF',
  foregroundBrightness: 1,
  foregroundAlpha: 1,
}

function decorations(partial: Partial<MapRoomDecorations>): MapRoomDecorations {
  return { graffiti: [], ...partial }
}

describe('buildMapDecoration()', () => {
  it('desaturates the floor palette the way the reference map does', () => {
    const res = buildMapDecoration(decorations({ floor }))

    expect(res.colors.plain).toBe('#923399')
    // Swamp is 70% of the *already desaturated* plain plus 30% of the raw swamp colour.
    expect(res.colors.swamp).toBe('#79469c')
  })

  it('desaturates walls with their own factor', () => {
    const res = buildMapDecoration(decorations({ wall }))
    expect(res.colors.wall).toBe('#666d8c')
  })

  it('passes the road colour through untouched', () => {
    const res = buildMapDecoration(decorations({ floor }))
    expect(res.colors.road).toBe('#E9A7EE')
  })

  it('builds one overlay per landscape half, each with its own saturation factor', () => {
    const res = buildMapDecoration(decorations({ floor, wall }))

    expect(res.overlays).toHaveLength(2)
    expect(res.overlays[0]).toEqual({ url: 'floor.png', tint: 0x341a36, alpha: 0.87, target: 'floor' })
    expect(res.overlays[1]).toMatchObject({ url: 'wall.png', alpha: 1, target: 'wall' })
  })

  it('skips an overlay that has no texture or no colour', () => {
    expect(buildMapDecoration(decorations({ floor: { ...floor, foregroundUrl: undefined } })).overlays).toEqual([])
    expect(buildMapDecoration(decorations({ floor: { ...floor, foregroundColor: undefined } })).overlays).toEqual([])
  })

  it('leaves the palette empty when a half carries no background colour', () => {
    const res = buildMapDecoration(decorations({ wall: { ...wall, backgroundColor: undefined } }))
    expect(res.colors.wall).toBeUndefined()
  })

  it('flattens graffiti into one sprite per graphic', () => {
    const res = buildMapDecoration(decorations({
      graffiti: [{
        x: 10, y: 12, width: 4, height: 3, tiling: true, tileScale: 2,
        alpha: 0.5, lighting: false, brightness: 1,
        graphics: [{ url: 'a.svg', color: '#ff0000' }, { url: 'b.svg' }],
      }],
    }))

    expect(res.graffiti).toHaveLength(2)
    expect(res.graffiti[0]).toMatchObject({ url: 'a.svg', x: 10, y: 12, width: 4, height: 3, alpha: 0.5, tiling: true, tileScale: 2 })
    // Unlit graffiti is dimmed to half lightness and heavily desaturated.
    expect(res.graffiti[0].tint).toBe(0x503030)
    expect(res.graffiti[1].tint).toBeUndefined()
  })

  it('keeps a lit graffiti at its own brightness', () => {
    const res = buildMapDecoration(decorations({
      graffiti: [{
        x: 0, y: 0, width: 1, height: 1, tiling: false, tileScale: 1,
        alpha: 1, lighting: true, brightness: 1,
        graphics: [{ url: 'a.svg', color: '#ff0000' }],
      }],
    }))

    expect(res.graffiti[0].tint).toBe(0xff0000)
  })
})
