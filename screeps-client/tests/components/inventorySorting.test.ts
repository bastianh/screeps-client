import { describe, it, expect } from 'vitest'
import type { ApiUserDecorationItem } from 'screeps-connectivity'
import { sortItems, rarityColor, DECORATION_TYPE_LABELS } from '../../src/components/inventory/sorting'

function item(id: string, createdAt: string, rarity?: number, room?: string): ApiUserDecorationItem {
  return {
    _id: id,
    createdAt,
    active: room ? { room } : null,
    decoration: { _id: `d${id}`, type: 'wallGraffiti', rarity },
  }
}

const items = [
  item('a', '2024-01-02', 3, 'E1S1'),
  item('b', '2024-01-01', 5),
  item('c', '2024-01-03', 1, 'W9N9'),
]

describe('sortItems()', () => {
  it('sorts newest first', () => {
    expect(sortItems(items, 'newest').map(i => i._id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts oldest first', () => {
    expect(sortItems(items, 'oldest').map(i => i._id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts rare to common and back', () => {
    expect(sortItems(items, 'rarest').map(i => i._id)).toEqual(['b', 'a', 'c'])
    expect(sortItems(items, 'commonest').map(i => i._id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by room descending, with unactivated items last', () => {
    expect(sortItems(items, 'room').map(i => i._id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the input array untouched', () => {
    const input = [...items]
    sortItems(input, 'oldest')
    expect(input.map(i => i._id)).toEqual(['a', 'b', 'c'])
  })

  it('treats a missing rarity as the lowest', () => {
    const mixed = [item('x', '2024-01-01'), item('y', '2024-01-01', 2)]
    expect(sortItems(mixed, 'rarest').map(i => i._id)).toEqual(['y', 'x'])
  })
})

describe('rarityColor()', () => {
  it('gives every rarity tier a colour and falls back for a missing one', () => {
    const tiers = [1, 2, 3, 4, 5].map(rarityColor)
    expect(new Set(tiers).size).toBe(5)
    expect(rarityColor(undefined)).toBe(rarityColor(1))
    expect(rarityColor(99)).toBe(rarityColor(1))
  })
})

describe('DECORATION_TYPE_LABELS', () => {
  it('labels every decoration type the API can return', () => {
    const types = ['badge', 'creep', 'wallGraffiti', 'wallLandscape', 'floorLandscape', 'landscape', 'metadata', 'object']
    for (const type of types) expect(DECORATION_TYPE_LABELS[type]).toBeTruthy()
  })
})
