import { describe, it, expect } from 'vitest'
import type { ApiRoomDecorationDef, ApiUserDecorationItem } from 'screeps-connectivity'
import {
  buildActiveState, propEntries, needsRoom, collidingTypes, blockedRooms, roomKey,
  findRoomOption, editorGroups, grantedBadgeSymbols, splitList, joinList,
} from '../../src/components/inventory/activation'

function decoration(partial: Partial<ApiRoomDecorationDef> = {}): ApiRoomDecorationDef {
  return { _id: 'd1', type: 'wallGraffiti', ...partial }
}

function owned(id: string, type: string, room?: string, shard?: string): ApiUserDecorationItem {
  return {
    _id: id,
    createdAt: '2024-01-01',
    active: room ? { room, ...(shard ? { shard } : {}) } : null,
    decoration: { _id: `def-${id}`, type: type as ApiRoomDecorationDef['type'] },
  }
}

describe('propEntries()', () => {
  it('skips the layout constraints that sit alongside the descriptors', () => {
    const d = decoration({
      props: {
        proportional: true,
        minWidth: 2,
        maxHeight: 10,
        color: { type: 'color', default: '#fff' },
      },
    })
    expect(propEntries(d).map(([name]) => name)).toEqual(['color'])
  })

  it('returns nothing when the decoration has no schema', () => {
    expect(propEntries(decoration())).toEqual([])
  })
})

describe('buildActiveState()', () => {
  const d = decoration({
    props: {
      x: { type: 'range', default: 0 },
      color: { type: 'color', default: '#ffffff' },
      locked: { type: 'range', readonly: true, default: 7 },
    },
  })

  it('seeds every property from its default', () => {
    expect(buildActiveState(d, null)).toEqual({ x: 0, color: '#ffffff', locked: 7 })
  })

  it('includes read-only properties — they are state, just not editable', () => {
    expect(buildActiveState(d, null).locked).toBe(7)
  })

  it('keeps the values an already-placed decoration has', () => {
    const active = buildActiveState(d, { x: 12, color: '#ff0000', locked: 7 })
    expect(active).toMatchObject({ x: 12, color: '#ff0000' })
  })

  it('keeps a falsy existing value rather than falling back to the default', () => {
    expect(buildActiveState(d, { x: 0, color: '' }).color).toBe('')
  })

  it('drops values whose property left the schema', () => {
    expect(buildActiveState(d, { x: 1, gone: 'stale' })).not.toHaveProperty('gone')
  })

  it('carries the target shard and room across', () => {
    const active = buildActiveState(d, { shard: 'shard1', room: 'E1S1' })
    expect(active).toMatchObject({ shard: 'shard1', room: 'E1S1' })
  })
})

describe('needsRoom()', () => {
  it('is false for the account-wide types', () => {
    expect(needsRoom('creep')).toBe(false)
    expect(needsRoom('badge')).toBe(false)
    expect(needsRoom('wallGraffiti')).toBe(true)
    expect(needsRoom('landscape')).toBe(true)
  })
})

describe('collidingTypes()', () => {
  it('lets a wall and a floor landscape share a room', () => {
    expect(collidingTypes('wallLandscape')).not.toContain('floorLandscape')
    expect(collidingTypes('floorLandscape')).not.toContain('wallLandscape')
  })

  it('makes the combined landscape block both halves', () => {
    expect(collidingTypes('landscape')).toEqual(expect.arrayContaining(['wallLandscape', 'floorLandscape', 'landscape']))
    expect(collidingTypes('wallLandscape')).toContain('landscape')
    expect(collidingTypes('floorLandscape')).toContain('landscape')
  })

  it('leaves graffiti unrestricted', () => {
    expect(collidingTypes('wallGraffiti')).toEqual([])
  })

  it('clashes skins and object overlays only with their own type', () => {
    expect(collidingTypes('metadata')).toEqual(['metadata'])
    expect(collidingTypes('object')).toEqual(['object'])
  })
})

describe('blockedRooms()', () => {
  const items = [
    owned('a', 'wallLandscape', 'E1S1'),
    owned('b', 'floorLandscape', 'E2S2'),
    owned('c', 'wallGraffiti', 'E3S3'),
    owned('d', 'wallLandscape'),
  ]

  it('blocks only rooms holding a clashing type', () => {
    const blocked = blockedRooms(items, 'wallLandscape')
    expect([...blocked.keys()]).toEqual([roomKey(null, 'E1S1')])
  })

  it('blocks both halves for the combined type', () => {
    const blocked = blockedRooms(items, 'landscape')
    expect([...blocked.keys()].sort()).toEqual([roomKey(null, 'E1S1'), roomKey(null, 'E2S2')].sort())
  })

  it('returns nothing for a type that never collides', () => {
    expect(blockedRooms(items, 'wallGraffiti').size).toBe(0)
  })

  it('does not block the room the edited decoration already sits in', () => {
    expect(blockedRooms(items, 'wallLandscape', 'a').size).toBe(0)
  })

  it('ignores decorations that are not placed', () => {
    expect(blockedRooms([owned('d', 'wallLandscape')], 'wallLandscape').size).toBe(0)
  })

  it('keeps the same room name on two shards apart', () => {
    const twoShards = [owned('a', 'wallLandscape', 'E1S1', 'shard0'), owned('b', 'wallLandscape', 'E1S1', 'shard1')]
    expect(blockedRooms(twoShards, 'wallLandscape').size).toBe(2)
  })
})

describe('findRoomOption()', () => {
  const options = [
    { room: 'W1N1', shard: 'shard0' },
    { room: 'W1N1', shard: 'shard1' },
    { room: 'W2N2', shard: null },
  ]

  it('prefers the entry on the same shard', () => {
    expect(findRoomOption(options, 'W1N1', 'shard1')).toEqual({ room: 'W1N1', shard: 'shard1' })
  })

  it('matches a shardless room', () => {
    expect(findRoomOption(options, 'W2N2', null)).toEqual({ room: 'W2N2', shard: null })
  })

  /** A single-shard server reports no shard for the open room but may still list one. */
  it('falls back to the room name when the shards disagree', () => {
    expect(findRoomOption(options, 'W1N1', null)).toEqual({ room: 'W1N1', shard: 'shard0' })
  })

  it('finds nothing for a room the account does not hold', () => {
    expect(findRoomOption(options, 'W9N9', null)).toBeUndefined()
  })
})

describe('editorGroups()', () => {
  it('sorts properties into their editor blocks and drops read-only ones', () => {
    const groups = editorGroups(decoration({
      type: 'object',
      props: {
        note: { type: 'string', default: '' },
        mainColor: { type: 'color', default: '#fff' },
        glow: { type: 'display', default: false },
        alpha: { type: 'range', default: 1 },
        hidden: { type: 'range', readonly: true, default: 1 },
      },
    }))

    expect(groups.inputs.map(([n]) => n)).toEqual(['note'])
    expect(groups.colors.map(([n]) => n)).toEqual(['mainColor'])
    expect(groups.displays.map(([n]) => n)).toEqual(['glow'])
    expect(groups.ranges.map(([n]) => n)).toEqual(['alpha'])
    expect(groups.animation).toBeNull()
  })

  it('pulls the animation property out of the free-text block', () => {
    const groups = editorGroups(decoration({
      props: { animation: { type: 'string', label: 'Animation', default: '' } },
    }))
    expect(groups.animation?.[0]).toBe('animation')
    expect(groups.inputs).toEqual([])
  })

  it('offers only the colours a graphic actually binds, for creep and graffiti', () => {
    const props = {
      used: { type: 'color' as const, default: '#fff' },
      unused: { type: 'color' as const, default: '#fff' },
    }
    const graphics = [{ url: 'a.svg', color: 'used' }]

    expect(editorGroups(decoration({ type: 'creep', props, graphics })).colors.map(([n]) => n)).toEqual(['used'])
    // Other types have no such indirection, so every colour stays on offer.
    expect(editorGroups(decoration({ type: 'object', props, graphics })).colors.map(([n]) => n)).toEqual(['used', 'unused'])
  })
})

describe('list properties', () => {
  it('round-trips through the !SEP! separator', () => {
    expect(splitList('a!SEP!b')).toEqual(['a', 'b'])
    expect(joinList(['a', 'b'])).toBe('a!SEP!b')
  })

  it('treats an empty or missing value as an empty list', () => {
    expect(splitList('')).toEqual([])
    expect(splitList(undefined)).toEqual([])
    expect(joinList([])).toBe('')
  })

  it('drops empty entries rather than emitting a stray separator', () => {
    expect(joinList(['a', '', 'b'])).toBe('a!SEP!b')
    expect(splitList('a!SEP!!SEP!b')).toEqual(['a', 'b'])
  })
})

describe('grantedBadgeSymbols()', () => {
  const badgeItem = (
    id: string,
    symbol: { path1: string; path2: string } | undefined,
    active: boolean,
  ): ApiUserDecorationItem => ({
    _id: id,
    createdAt: '2024-01-01',
    active: active ? {} : null,
    decoration: { _id: `def-${id}`, type: 'badge', badge: symbol },
  })

  it('collects the symbols of active badge decorations only', () => {
    const items = [
      badgeItem('worn', { path1: 'M 0 0', path2: 'M 1 1' }, true),
      badgeItem('owned', { path1: 'M 2 2', path2: '' }, false),
      owned('placed', 'wallGraffiti', 'W1N1'),
    ]
    expect(grantedBadgeSymbols(items)).toEqual([{ path1: 'M 0 0', path2: 'M 1 1' }])
  })

  it('deduplicates identical symbols from separate grants', () => {
    const items = [
      badgeItem('a', { path1: 'M 0 0', path2: '' }, true),
      badgeItem('b', { path1: 'M 0 0', path2: '' }, true),
    ]
    expect(grantedBadgeSymbols(items)).toHaveLength(1)
  })

  it('skips badge decorations granting no symbol', () => {
    const items = [
      badgeItem('empty', undefined, true),
      badgeItem('blank', { path1: '', path2: '' }, true),
    ]
    expect(grantedBadgeSymbols(items)).toEqual([])
  })
})
