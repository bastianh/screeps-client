import { describe, it, expect } from 'vitest'
import { buildRoomDecorations } from '../../src/stores/MapStatsStore.js'
import type { ApiMapStatsRoomStat, ApiMapStatsDecorationDef, ApiDecorationActive } from '../../src/types/api.js'

function stat(...decorations: Array<{ decoration: string; active: ApiDecorationActive }>): ApiMapStatsRoomStat {
  return {
    status: 'normal',
    novice: null,
    respawnArea: null,
    openTime: null,
    decorations: decorations.map((d, i) => ({ _id: `i${i}`, user: 'u1', ...d })),
  }
}

const defs: Record<string, ApiMapStatsDecorationDef> = {
  floorDef: { type: 'floorLandscape', floorForegroundUrl: 'floor.png' },
  wallDef: { type: 'wallLandscape', foregroundUrl: 'wall.png' },
  bothDef: { type: 'landscape', floorForegroundUrl: 'floor.png', foregroundUrl: 'wall.png' },
  graffitiDef: { type: 'wallGraffiti', tiling: true, graphics: [{ url: 'g.svg', color: 'tint1' }] },
  creepDef: { type: 'creep', graphics: [{ url: 'c.svg' }] },
}

describe('buildRoomDecorations()', () => {
  it('returns undefined when the room has no decorations', () => {
    expect(buildRoomDecorations(stat(), defs)).toBeUndefined()
  })

  it('ignores decorations that are not flagged for the world map', () => {
    const res = buildRoomDecorations(stat({ decoration: 'floorDef', active: { floorBackgroundColor: '#112233' } }), defs)
    expect(res).toBeUndefined()
  })

  it('resolves the floor half against the definition dictionary', () => {
    const res = buildRoomDecorations(stat({
      decoration: 'floorDef',
      active: {
        world: true,
        floorBackgroundColor: '#112233',
        floorBackgroundBrightness: '0.5',
        swampColor: '#445566',
        roadsColor: '#778899',
        floorForegroundColor: '#aabbcc',
        floorForegroundAlpha: '0.8',
      },
    }), defs)

    expect(res?.floor).toEqual({
      backgroundColor: '#112233',
      backgroundBrightness: 0.5,
      swampColor: '#445566',
      roadsColor: '#778899',
      foregroundUrl: 'floor.png',
      foregroundColor: '#aabbcc',
      foregroundBrightness: 1,
      foregroundAlpha: 0.8,
    })
    expect(res?.wall).toBeUndefined()
  })

  it('treats the combined `landscape` type as both halves', () => {
    const res = buildRoomDecorations(stat({
      decoration: 'bothDef',
      active: { world: true, floorBackgroundColor: '#112233', backgroundColor: '#445566' },
    }), defs)

    expect(res?.floor?.backgroundColor).toBe('#112233')
    expect(res?.floor?.foregroundUrl).toBe('floor.png')
    expect(res?.wall?.backgroundColor).toBe('#445566')
    expect(res?.wall?.foregroundUrl).toBe('wall.png')
  })

  it('keeps the first landscape of each half', () => {
    const res = buildRoomDecorations(stat(
      { decoration: 'floorDef', active: { world: true, floorBackgroundColor: '#111111' } },
      { decoration: 'floorDef', active: { world: true, floorBackgroundColor: '#222222' } },
      { decoration: 'wallDef', active: { world: true, backgroundColor: '#333333' } },
    ), defs)

    expect(res?.floor?.backgroundColor).toBe('#111111')
    expect(res?.wall?.backgroundColor).toBe('#333333')
  })

  it('falls back to the colour props when the response carries no definitions', () => {
    // Private servers may omit the `decorations` dictionary; no other decoration type
    // carries these props, so they identify the half on their own.
    const res = buildRoomDecorations(stat(
      { decoration: 'unknown', active: { world: true, floorBackgroundColor: '#112233' } },
      { decoration: 'unknown2', active: { world: true, backgroundColor: '#445566' } },
    ), {})

    expect(res?.floor?.backgroundColor).toBe('#112233')
    expect(res?.wall?.backgroundColor).toBe('#445566')
    // Without a definition there is no overlay texture to point at.
    expect(res?.floor?.foregroundUrl).toBeUndefined()
  })

  it('collects graffiti with its graphics prop references resolved', () => {
    const res = buildRoomDecorations(stat({
      decoration: 'graffitiDef',
      active: { world: true, x: 10, y: '12', width: 4, height: 4, tileScale: 2, alpha: 0.5, tint1: '#ff0000' },
    }), defs)

    expect(res?.graffiti).toHaveLength(1)
    expect(res?.graffiti[0]).toMatchObject({
      x: 10, y: 12, width: 4, height: 4, tiling: true, tileScale: 2, alpha: 0.5,
      graphics: [{ url: 'g.svg', color: '#ff0000' }],
    })
  })

  it('drops graphics whose `visible` prop is falsy', () => {
    const res = buildRoomDecorations(stat({
      decoration: 'hidden',
      active: { world: true, hasRing: false },
    }), {
      hidden: { type: 'wallGraffiti', graphics: [{ url: 'base.svg' }, { url: 'ring.svg', visible: 'hasRing' }] },
    })

    expect(res?.graffiti[0].graphics.map(g => g.url)).toEqual(['base.svg'])
  })

  it('ignores decoration types the map does not render', () => {
    expect(buildRoomDecorations(stat({ decoration: 'creepDef', active: { world: true } }), defs)).toBeUndefined()
  })
})
