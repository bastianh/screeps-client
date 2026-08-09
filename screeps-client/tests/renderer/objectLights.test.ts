import { describe, it, expect } from 'vitest'
import type { RoomObject } from 'screeps-connectivity'
import { objectGlows } from '../../src/renderer/objectLights'

function obj(type: string, extra: Record<string, unknown> = {}): RoomObject {
  return { _id: 'x', type, room: 'W1N1', x: 25, y: 25, ...extra }
}

/** Largest pool an object emits, in reference units (100 per tile). */
function widest(o: RoomObject): number {
  return objectGlows(o).reduce((max, glow) => Math.max(max, glow.size), 0)
}

describe('objectGlows()', () => {
  it('gives terrain structures no light at all', () => {
    for (const type of ['road', 'constructedWall', 'rampart', 'constructionSite', 'flag', 'extractor']) {
      expect(objectGlows(obj(type))).toHaveLength(0)
    }
  })

  it('matches the reference metadata for a spawn', () => {
    expect(objectGlows(obj('spawn', { store: { energy: 300 } }))).toEqual([
      { size: 600, alpha: 0.5 },
      { size: 100, alpha: 1 },
    ])
    // An empty spawn keeps the halo and loses the bright core.
    expect(objectGlows(obj('spawn', { store: { energy: 0 } }))).toEqual([{ size: 600, alpha: 0.5 }])
  })

  it('scales an extension halo with its tier, and only when it holds energy', () => {
    const filled = (capacity: number) => widest(obj('extension', {
      store: { energy: 10 }, storeCapacityResource: { energy: capacity },
    }))
    expect(filled(50)).toBe(200)
    expect(filled(100)).toBe(220)
    expect(filled(200)).toBe(250)
    expect(objectGlows(obj('extension', { store: { energy: 0 }, storeCapacity: 200 }))).toHaveLength(0)
  })

  it('keeps an extension well under a spawn — the halo that used to be shared', () => {
    const extension = obj('extension', { store: { energy: 50 }, storeCapacity: 200 })
    expect(widest(extension)).toBeLessThan(widest(obj('spawn')))
  })

  it('lights a lab only for a non-energy payload', () => {
    expect(objectGlows(obj('lab', { store: { energy: 2000 } }))).toHaveLength(0)
    expect(objectGlows(obj('lab', { store: { energy: 2000, H: 5 } }))).toEqual([
      { size: 500, alpha: 0.3 },
      { size: 150, alpha: 1 },
    ])
  })

  it('tints a mineral by its resource and a deposit by its commodity', () => {
    expect(objectGlows(obj('mineral', { mineralType: 'U' }))[0].tint).toBe(0x58D7F9)
    expect(objectGlows(obj('deposit', { depositType: 'mist' }))[0].tint).toBe(0xda6bf5)
  })

  it('dims an NPC creep and skips one still spawning', () => {
    expect(objectGlows(obj('creep', { user: 'me' }))[1].alpha).toBe(1)
    expect(objectGlows(obj('creep', { user: '2' }))[1].alpha).toBe(0.5)
    expect(objectGlows(obj('creep', { user: 'me', spawning: true }))).toHaveLength(0)
  })

  it('sizes a dropped pile by how much is lying there', () => {
    expect(widest(obj('energy', { energy: 1250 }))).toBe(60)
    expect(widest(obj('energy', { energy: 625 }))).toBe(30)
    // Never larger than a full pile, however much the server reports.
    expect(widest(obj('energy', { energy: 5000 }))).toBe(60)
    expect(objectGlows(obj('energy', { energy: 0 }))).toHaveLength(0)
  })
})
