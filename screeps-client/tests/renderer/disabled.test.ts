import { describe, it, expect } from 'vitest'
import type { RoomObject } from 'screeps-connectivity'
import { computeDisabledIds } from '../../src/renderer/objects/disabled'

const OWNER = 'me'

function obj(id: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}): [string, RoomObject] {
  return [id, { _id: id, type, room: 'W1N1', x, y, user: OWNER, ...extra }]
}

function controller(level: number, x = 25, y = 25, user: string | undefined = OWNER): [string, RoomObject] {
  return ['ctrl', { _id: 'ctrl', type: 'controller', room: 'W1N1', x, y, level, ...(user ? { user } : {}) }]
}

function run(entries: Array<[string, RoomObject]>): Set<string> {
  return computeDisabledIds(new Map(entries))
}

describe('computeDisabledIds()', () => {
  it('disables the surplus farthest from the controller', () => {
    // RCL 3 allows a single tower; the nearer one keeps running.
    const disabled = run([
      controller(3),
      obj('near', 'tower', 26, 25),
      obj('far', 'tower', 40, 25),
    ])
    expect([...disabled]).toEqual(['far'])
  })

  it('keeps structures within the level cap active', () => {
    const disabled = run([
      controller(5),
      obj('t1', 'tower', 26, 25),
      obj('t2', 'tower', 40, 25),
    ])
    expect(disabled.size).toBe(0)
  })

  it('disables types the current level does not allow at all', () => {
    const disabled = run([controller(1), obj('lab', 'lab', 26, 25)])
    expect([...disabled]).toEqual(['lab'])
  })

  it('disables everything in an unowned room', () => {
    const disabled = run([
      controller(0, 25, 25, undefined),
      obj('s', 'spawn', 26, 25),
      obj('e', 'extension', 27, 25),
    ])
    expect(disabled).toEqual(new Set(['s', 'e']))
  })

  it('disables structures whose owner does not own the controller', () => {
    const disabled = run([
      controller(8, 25, 25, 'someone-else'),
      obj('s', 'spawn', 26, 25),
    ])
    expect([...disabled]).toEqual(['s'])
  })

  it('applies the cap per owner', () => {
    const disabled = run([
      controller(3),
      obj('mine', 'tower', 26, 25),
      obj('theirs', 'tower', 27, 25, { user: 'someone-else' }),
    ])
    // Only the foreign tower is off — it fails the controller-owner check.
    expect([...disabled]).toEqual(['theirs'])
  })

  it('never disables roads, walls or ramparts', () => {
    const disabled = run([
      controller(1),
      obj('r', 'road', 26, 25),
      obj('w', 'constructedWall', 27, 25),
      obj('ra', 'rampart', 28, 25),
    ])
    expect(disabled.size).toBe(0)
  })

  it('ignores NPC-owned structures and unowned extractors', () => {
    const disabled = run([
      controller(1),
      obj('inv', 'tower', 26, 25, { user: '2' }),
      ['ext', { _id: 'ext', type: 'extractor', room: 'W1N1', x: 27, y: 25 }],
    ])
    expect(disabled.size).toBe(0)
  })

  it('leaves non-structures alone', () => {
    const disabled = run([
      controller(1),
      obj('c', 'creep', 26, 25),
      ['src', { _id: 'src', type: 'source', room: 'W1N1', x: 27, y: 25 }],
    ])
    expect(disabled.size).toBe(0)
  })

  it('keeps containers running in a room with no controller', () => {
    const disabled = run([obj('c1', 'container', 10, 10), obj('c2', 'container', 11, 10)])
    expect(disabled.size).toBe(0)
  })
})
