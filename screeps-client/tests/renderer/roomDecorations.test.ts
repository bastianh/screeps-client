import { describe, it, expect } from 'vitest'
import type { ApiRoomDecorationItem } from 'screeps-connectivity'
import { parseRoomDecorations, mergeDecorationItems, creepMatchesDecoration, type CreepDecoration } from '../../src/renderer/roomDecorations'

function response(...decorations: ApiRoomDecorationItem[]): ApiRoomDecorationItem[] {
  return decorations
}

function item(partial: Partial<ApiRoomDecorationItem> & { decoration: ApiRoomDecorationItem['decoration'] }): ApiRoomDecorationItem {
  return { _id: 'i1', user: 'u1', active: {}, ...partial }
}

describe('parseRoomDecorations()', () => {
  describe('landscapes', () => {
    it('applies floor and wall landscapes to the terrain decoration', () => {
      const res = parseRoomDecorations(response(
        item({
          active: { floorBackgroundColor: '#f67bff', floorBackgroundBrightness: 0.98, roadsColor: '#e9a7ee', roadsBrightness: 0.41 },
          decoration: { _id: 'd1', type: 'floorLandscape' },
        }),
        item({
          _id: 'i2',
          active: { backgroundColor: '#5261a0', strokeColor: '#465ec4', strokeWidth: '30' },
          decoration: { _id: 'd2', type: 'wallLandscape' },
        }),
      ))

      expect(res.terrain?.floorColor).toBe(0xf573ff)
      expect(res.roadColor).toBe(0x831b8b)
      expect(res.terrain?.wallFillColor).toBe(0x5261a0)
      expect(res.terrain?.wallBorderColor).toBe(0x465ec4)
      // `paint-order: stroke` hides the inner half of the reference's centred stroke, and
      // its SVG viewBox is 100 units per tile — so 30 shows as 0.15 of a tile.
      expect(res.terrain?.wallBorderWidth).toBeCloseTo(0.15)
    })

    it('converts the reference default stroke widths to our undecorated defaults', () => {
      const res = parseRoomDecorations(response(item({
        active: { strokeWidth: 10, swampStrokeWidth: 50 },
        decoration: { _id: 'd1', type: 'landscape' },
      })))

      expect(res.terrain?.wallBorderWidth).toBeCloseTo(0.05)
      expect(res.terrain?.swampBorderWidth).toBeCloseTo(0.25)
    })

    it('carries strokeLighting through as the wall rim brightness', () => {
      const res = parseRoomDecorations(response(item({
        active: { strokeLighting: 0.4 },
        decoration: { _id: 'd1', type: 'wallLandscape' },
      })))

      expect(res.terrain?.wallBorderLighting).toBeCloseTo(0.4)
    })

    it('tiles a landscape only when the definition declares a tileScale', () => {
      const tiled = parseRoomDecorations(response(item({
        decoration: { _id: 'd1', type: 'landscape', floorForegroundUrl: 'f.png', tileScale: 4 },
      })))
      const stretched = parseRoomDecorations(response(item({
        decoration: { _id: 'd2', type: 'landscape', floorForegroundUrl: 'f.png' },
      })))

      expect(tiled.terrain?.floorTextureTileScale).toBe(4)
      expect(stretched.terrain?.floorTextureTileScale).toBeUndefined()
    })

    it('ignores a placement tileScale on landscapes, as the reference does', () => {
      const res = parseRoomDecorations(response(item({
        active: { tileScale: 9 },
        decoration: { _id: 'd1', type: 'floorLandscape', floorForegroundUrl: 'f.png' },
      })))

      expect(res.terrain?.floorTextureTileScale).toBeUndefined()
    })

    it('keeps the first floor landscape and ignores later ones', () => {
      const res = parseRoomDecorations(response(
        item({ active: { floorBackgroundColor: '#112233' }, decoration: { _id: 'd1', type: 'floorLandscape' } }),
        item({ _id: 'i2', active: { floorBackgroundColor: '#445566' }, decoration: { _id: 'd2', type: 'floorLandscape' } }),
      ))

      expect(res.terrain?.floorColor).toBe(0x112233)
    })

    it('treats the combined `landscape` type as both floor and wall', () => {
      const res = parseRoomDecorations(response(item({
        active: { floorBackgroundColor: '#112233', backgroundColor: '#445566' },
        decoration: { _id: 'd1', type: 'landscape', foregroundUrl: 'wall.png', floorForegroundUrl: 'floor.png' },
      })))

      expect(res.terrain?.floorColor).toBe(0x112233)
      expect(res.terrain?.wallFillColor).toBe(0x445566)
      expect(res.terrain?.floorTextureUrl).toBe('floor.png')
      expect(res.terrain?.wallTextureUrl).toBe('wall.png')
    })
  })

  describe('graffiti', () => {
    it('collects every graffiti item with resolved geometry and sprites', () => {
      const res = parseRoomDecorations(response(
        item({
          active: { x: '10', y: 12, width: 4, height: '3', rotation: 1.57, alpha: 0.5, flip: '1', brightness: 1, tint1: '#ff0000' },
          decoration: {
            _id: 'd1', type: 'wallGraffiti', tiling: true, tileScale: 2,
            graphics: [{ url: 'a.svg', color: 'tint1' }],
          },
        }),
        item({ _id: 'i2', decoration: { _id: 'd2', type: 'wallGraffiti', graphics: [{ url: 'b.svg' }] } }),
      ))

      expect(res.graffiti).toHaveLength(2)
      const [first] = res.graffiti
      expect(first).toMatchObject({ x: 10, y: 12, width: 4, height: 3, rotation: 1.57, alpha: 0.5, flip: true })
      expect(first.sprites).toEqual([{ url: 'a.svg', tint: 0xff0000, alpha: 1, tiling: true, tileScale: 2 }])
    })

    it('skips graphics whose `visible` prop is falsy and resolves alpha by prop name', () => {
      const res = parseRoomDecorations(response(item({
        active: { hasRing: false, ringAlpha: 0.25 },
        decoration: {
          _id: 'd1', type: 'wallGraffiti',
          graphics: [
            { url: 'base.svg' },
            { url: 'ring.svg', visible: 'hasRing' },
            { url: 'glow.svg', alpha: 'ringAlpha' },
          ],
        },
      })))

      expect(res.graffiti[0].sprites.map(s => s.url)).toEqual(['base.svg', 'glow.svg'])
      expect(res.graffiti[0].sprites[1].alpha).toBe(0.25)
    })

    it('leaves the tint undefined when the referenced colour prop is missing', () => {
      const res = parseRoomDecorations(response(item({
        decoration: { _id: 'd1', type: 'wallGraffiti', graphics: [{ url: 'a.svg', color: 'missing' }] },
      })))

      expect(res.graffiti[0].sprites[0].tint).toBeUndefined()
    })
  })

  describe('creep overlays', () => {
    it('splits the !SEP!-separated name filter and normalises string booleans', () => {
      const res = parseRoomDecorations(response(item({
        active: {
          nameFilter: 'harvester!SEP!hauler', exclude: '1', syncRotate: 'true',
          position: 'below', lighting: true, animation: 'blink', width: 256, height: 256,
        },
        decoration: { _id: 'd1', type: 'creep', graphics: [{ url: 'c.svg' }] },
      })))

      expect(res.creeps).toHaveLength(1)
      expect(res.creeps[0]).toMatchObject({
        nameFilter: ['harvester', 'hauler'],
        exclude: true,
        syncRotate: true,
        below: true,
        lighting: true,
        animation: 'blink',
      })
      // Creep sizes arrive in the reference renderer's pixels (cell = 100), not cells.
      expect(res.creeps[0].width).toBeCloseTo(2.56)
      expect(res.creeps[0].height).toBeCloseTo(2.56)
    })

    it('yields an empty name filter when the prop is absent', () => {
      const res = parseRoomDecorations(response(item({ decoration: { _id: 'd1', type: 'creep' } })))
      expect(res.creeps[0].nameFilter).toEqual([])
      expect(res.creeps[0].below).toBe(false)
    })

    it('drops an unknown animation name', () => {
      const res = parseRoomDecorations(response(item({
        active: { animation: 'None' },
        decoration: { _id: 'd1', type: 'creep' },
      })))
      expect(res.creeps[0].animation).toBeUndefined()
    })
  })

  describe('object overlays', () => {
    it('carries the target object type and the owner', () => {
      const res = parseRoomDecorations(response(item({
        user: 'owner1',
        active: { width: 150, height: 50 },
        decoration: { _id: 'd1', type: 'object', objectType: 'controller', graphics: [{ url: 'o.svg' }] },
      })))

      expect(res.objects).toHaveLength(1)
      expect(res.objects[0]).toMatchObject({ objectType: 'controller', user: 'owner1' })
      expect(res.objects[0].width).toBeCloseTo(1.5)
      expect(res.objects[0].height).toBeCloseTo(0.5)
    })
  })

  it('leaves graffiti sizes in cells', () => {
    const res = parseRoomDecorations(response(item({
      active: { width: 8, height: 4 },
      decoration: { _id: 'd1', type: 'wallGraffiti', graphics: [{ url: 'g.svg' }] },
    })))

    expect(res.graffiti[0]).toMatchObject({ width: 8, height: 4 })
  })

  it('accepts an empty list', () => {
    expect(parseRoomDecorations([])).toEqual({ graffiti: [], creeps: [], objects: [] })
  })

  it('ignores unsupported types and returns empty lists', () => {
    const res = parseRoomDecorations(response(
      item({ decoration: { _id: 'd1', type: 'badge' } }),
      item({ _id: 'i2', decoration: { _id: 'd2', type: 'metadata' } }),
    ))

    expect(res).toEqual({ graffiti: [], creeps: [], objects: [] })
  })
})

describe('creepMatchesDecoration()', () => {
  function decoration(nameFilter: string[], exclude = false): CreepDecoration {
    return { nameFilter, exclude } as CreepDecoration
  }

  it('matches when any filter is a substring of the name', () => {
    const d = decoration(['harvest', 'haul'])
    expect(creepMatchesDecoration(d, 'harvester1')).toBe(true)
    expect(creepMatchesDecoration(d, 'hauler7')).toBe(true)
    expect(creepMatchesDecoration(d, 'defender')).toBe(false)
  })

  it('inverts on exclude', () => {
    const d = decoration(['harvest'], true)
    expect(creepMatchesDecoration(d, 'harvester1')).toBe(false)
    expect(creepMatchesDecoration(d, 'defender')).toBe(true)
  })

  it('matches every creep on an empty filter, and none when that is excluded', () => {
    // The reference splits the raw string, so an empty filter becomes [''] and
    // `name.includes('')` is true for everything.
    expect(creepMatchesDecoration(decoration([]), 'anything')).toBe(true)
    expect(creepMatchesDecoration(decoration([], true), 'anything')).toBe(false)
  })
})

describe('mergeDecorationItems()', () => {
  const base = item({ _id: 'a', decoration: { _id: 'd1', type: 'wallGraffiti' } })

  it('appends items the current list does not know', () => {
    const incoming = item({ _id: 'b', decoration: { _id: 'd2', type: 'wallGraffiti' } })
    const merged = mergeDecorationItems([base], [incoming])

    expect(merged.map(i => i._id)).toEqual(['a', 'b'])
  })

  it('returns the same array reference when nothing differs', () => {
    const current = [base]
    // A repeated payload must not churn the renderer — identity is what downstream
    // memos compare on.
    expect(mergeDecorationItems(current, [structuredClone(base)])).toBe(current)
  })

  it('replaces an item that actually changed, in place', () => {
    const current = [base, item({ _id: 'b', decoration: { _id: 'd2', type: 'creep' } })]
    const edited = item({ _id: 'a', active: { alpha: 0.5 }, decoration: { _id: 'd1', type: 'wallGraffiti' } })
    const merged = mergeDecorationItems(current, [edited])

    expect(merged).not.toBe(current)
    expect(merged.map(i => i._id)).toEqual(['a', 'b'])
    expect(merged[0].active.alpha).toBe(0.5)
  })

  it('handles an empty current list and an empty update', () => {
    expect(mergeDecorationItems([], [base]).map(i => i._id)).toEqual(['a'])
    const current = [base]
    expect(mergeDecorationItems(current, [])).toBe(current)
  })
})
