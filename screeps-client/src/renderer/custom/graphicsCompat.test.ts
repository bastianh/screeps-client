import { describe, it, expect } from 'vitest'
import type { Graphics } from 'pixi.js'
import { applyDrawings } from './graphicsCompat.js'

/** Records the calls applyDrawings dispatches, standing in for a real Graphics. */
function recorder(throwOn?: string) {
  const calls: Array<[string, unknown[]]> = []
  const names = [
    'lineStyle', 'beginFill', 'endFill', 'fill', 'stroke', 'setFillStyle', 'setStrokeStyle',
    'drawRect', 'drawRoundedRect', 'drawCircle', 'drawPolygon', 'rect', 'circle', 'poly',
    'moveTo', 'lineTo', 'closePath', 'clear', 'destroy',
  ]
  const g: Record<string, unknown> = {}
  for (const name of names) {
    g[name] = (...args: unknown[]) => {
      if (name === throwOn) throw new Error('boom')
      calls.push([name, args])
    }
  }
  return { g: g as unknown as Graphics, calls, methods: () => calls.map(([m]) => m) }
}

describe('applyDrawings', () => {
  it('forwards a legacy fill sequence unchanged', () => {
    const { g, calls, methods } = recorder()
    applyDrawings(g, [
      { method: 'lineStyle', params: [5, 0xffaaff] },
      { method: 'beginFill', params: [0xff00ff] },
      { method: 'drawRoundedRect', params: [-40, -40, 80, 80, 10] },
      { method: 'endFill', params: [] },
    ])
    expect(methods()).toEqual(['lineStyle', 'beginFill', 'drawRoundedRect', 'endFill'])
    expect(calls[2][1]).toEqual([-40, -40, 80, 80, 10])
  })

  it('flushes a fill the metadata never terminated', () => {
    const { g, methods } = recorder()
    applyDrawings(g, [
      { method: 'beginFill', params: [0x00ff00] },
      { method: 'drawCircle', params: [0, 0, 25] },
    ])
    expect(methods()).toEqual(['beginFill', 'drawCircle', 'fill'])
  })

  it('flushes a stroke-only path the metadata never terminated', () => {
    const { g, methods } = recorder()
    applyDrawings(g, [
      { method: 'lineStyle', params: [2, 0xffffff] },
      { method: 'moveTo', params: [0, 0] },
      { method: 'lineTo', params: [10, 10] },
    ])
    expect(methods()).toEqual(['lineStyle', 'moveTo', 'lineTo', 'stroke'])
  })

  it('does not flush when the path was already painted', () => {
    const { g, methods } = recorder()
    applyDrawings(g, [
      { method: 'setFillStyle', params: [{ color: 0xff0000 }] },
      { method: 'rect', params: [0, 0, 10, 10] },
      { method: 'fill', params: [] },
    ])
    expect(methods()).toEqual(['setFillStyle', 'rect', 'fill'])
  })

  it('treats clear as resetting the pending path', () => {
    const { g, methods } = recorder()
    applyDrawings(g, [
      { method: 'beginFill', params: [0x00ff00] },
      { method: 'drawCircle', params: [0, 0, 25] },
      { method: 'endFill', params: [] },
      { method: 'clear', params: [] },
    ])
    expect(methods()).toEqual(['beginFill', 'drawCircle', 'endFill', 'clear'])
  })

  it('refuses methods outside the drawing allowlist', () => {
    const { g, methods } = recorder()
    applyDrawings(g, [
      { method: 'destroy', params: [] },
      { method: 'rect', params: [0, 0, 1, 1] },
      { method: 'fill', params: [] },
    ])
    expect(methods()).toEqual(['rect', 'fill'])
  })

  it('keeps drawing after a method throws', () => {
    const { g, methods } = recorder('drawCircle')
    applyDrawings(g, [
      { method: 'drawCircle', params: ['nonsense'] },
      { method: 'rect', params: [0, 0, 1, 1] },
      { method: 'fill', params: [] },
    ])
    expect(methods()).toEqual(['rect', 'fill'])
  })
})
