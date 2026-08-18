import { describe, it, expect } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import type { RendererObjectMetadata, RoomObject } from 'screeps-connectivity'
import { CustomObjectVisual } from './CustomObjectVisual.js'
import { TILE_SIZE } from '../RoomRenderer.js'

/**
 * Drives the metadata pipeline with the descriptions the stock example mods
 * actually ship, and asserts on the display tree that comes out.
 *
 * `sprite` and `text` processors are exercised only where they don't need a
 * renderer: Pixi's Text measures through a canvas, which a plain Node test run
 * has no implementation of.
 */

function obj(over: Record<string, unknown> = {}): RoomObject {
  return { _id: 'a1', type: 'myobject', room: 'W1N1', x: 20, y: 20, ...over } as unknown as RoomObject
}

// renderer/draw.js — a rounded rect, drawn once
const DRAW_METADATA: RendererObjectMetadata = {
  processors: [{
    type: 'draw',
    once: true,
    payload: {
      drawings: [
        { method: 'lineStyle', params: [5, 0xffaaff] },
        { method: 'beginFill', params: [0xff00ff] },
        { method: 'drawRoundedRect', params: [-40, -40, 80, 80, 10] },
        { method: 'endFill' },
      ],
    },
  }],
}

// renderer/draw-parameterized.js — a calculation gated on score/scoreMax
const PARAMETERIZED_METADATA: RendererObjectMetadata = {
  calculations: [{
    id: 'scoreDrawRadius',
    props: ['score', 'scoreMax'],
    func: { $mul: [40, { $div: [{ $state: 'score' }, { $state: 'scoreMax' }] }] },
  }],
  processors: [
    { id: 'base', type: 'draw', once: true, payload: { drawings: [{ method: 'drawRect', params: [-40, -40, 80, 80] }] } },
    {
      id: 'score',
      type: 'circle',
      props: ['score', 'scoreMax'],
      // alpha rides along so the calculation's value is observable on the node.
      payload: { color: 0x00ff00, radius: { $calc: 'scoreDrawRadius' }, alpha: { $calc: 'scoreDrawRadius' } },
    },
  ],
}

describe('CustomObjectVisual', () => {
  it('places the metadata coordinate frame over the tile', () => {
    const visual = new CustomObjectVisual(DRAW_METADATA)
    visual.applyState(obj())
    // Metadata is authored with one tile spanning 100 units around the centre.
    expect(visual.root.scale.x).toBeCloseTo(TILE_SIZE / 100)
    expect(visual.root.position.x).toBe(TILE_SIZE / 2)
    expect(visual.root.position.y).toBe(TILE_SIZE / 2)
  })

  it('builds a Graphics from a draw processor', () => {
    const visual = new CustomObjectVisual(DRAW_METADATA)
    visual.applyState(obj())
    expect(visual.root.children).toHaveLength(1)
    expect(visual.root.children[0]).toBeInstanceOf(Graphics)
  })

  it('holds a once:true processor across state changes', () => {
    const visual = new CustomObjectVisual(DRAW_METADATA)
    visual.applyState(obj())
    const first = visual.root.children[0]
    visual.applyState(obj({ x: 21 }))
    expect(visual.root.children[0]).toBe(first)
  })

  it('recomputes a calculation and rebuilds only the processor that depends on it', () => {
    const visual = new CustomObjectVisual(PARAMETERIZED_METADATA)
    visual.applyState(obj({ score: 30, scoreMax: 100 }))

    const base = visual.root.children[0]
    const score = visual.root.children[1]
    expect(score.alpha).toBeCloseTo(12) // 40 * 30/100

    visual.applyState(obj({ score: 60, scoreMax: 100 }))
    expect(visual.root.children[0]).toBe(base)          // once:true, untouched
    expect(visual.root.children[1]).not.toBe(score)     // rebuilt
    expect(visual.root.children[1].alpha).toBeCloseTo(24)
  })

  it('leaves a props-gated processor alone when unrelated state changes', () => {
    const visual = new CustomObjectVisual(PARAMETERIZED_METADATA)
    visual.applyState(obj({ score: 30, scoreMax: 100 }))
    const score = visual.root.children[1]
    visual.applyState(obj({ score: 30, scoreMax: 100, hits: 500 }))
    expect(visual.root.children[1]).toBe(score)
  })

  it('honours shouldCreate and when gates', () => {
    const visual = new CustomObjectVisual({
      processors: [{
        type: 'draw',
        payload: { shouldCreate: { $state: 'visible' }, drawings: [{ method: 'drawRect', params: [0, 0, 10, 10] }] },
      }],
    })
    visual.applyState(obj({ visible: false }))
    expect(visual.root.children).toHaveLength(0)
    visual.applyState(obj({ visible: true }))
    expect(visual.root.children).toHaveLength(1)
  })

  it('nests a processor under another via parentId', () => {
    const visual = new CustomObjectVisual({
      processors: [
        { id: 'wrap', type: 'container', payload: {} },
        { id: 'inner', type: 'draw', payload: { parentId: 'wrap', drawings: [{ method: 'drawRect', params: [0, 0, 4, 4] }] } },
      ],
    })
    visual.applyState(obj())
    expect(visual.root.children).toHaveLength(1)
    const wrap = visual.root.children[0] as Container
    expect(wrap.children).toHaveLength(1)
    expect(wrap.children[0]).toBeInstanceOf(Graphics)
  })

  it('skips an unsupported processor type without taking the object down', () => {
    const visual = new CustomObjectVisual({
      processors: [
        { type: 'creepBuildBody', payload: {} },
        { type: 'draw', payload: { drawings: [{ method: 'drawRect', params: [0, 0, 4, 4] }] } },
      ],
    })
    expect(() => visual.applyState(obj())).not.toThrow()
    expect(visual.root.children).toHaveLength(1)
  })

  it('stands in a placeholder for a sprite whose texture is not registered', () => {
    const visual = new CustomObjectVisual({
      processors: [{ type: 'sprite', payload: { texture: 'nope', width: 100, height: 100 } }],
    })
    visual.applyState(obj())
    expect(visual.root.children).toHaveLength(1)
    expect(visual.root.children[0]).toBeInstanceOf(Container)
  })

  it('dims objects the server marks provisional', () => {
    const visual = new CustomObjectVisual(DRAW_METADATA)
    visual.applyState(obj({ temp: true }))
    expect(visual.root.alpha).toBeCloseTo(0.3)
  })

  it('tears the whole tree down on destroy', () => {
    const visual = new CustomObjectVisual(DRAW_METADATA)
    visual.applyState(obj())
    const child = visual.root.children[0]
    visual.destroy()
    expect(visual.root.destroyed).toBe(true)
    expect(child.destroyed).toBe(true)
  })
})
