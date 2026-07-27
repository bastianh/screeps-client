import { describe, it, expect } from 'vitest'
import type { ApiRoomDecorationDef } from 'screeps-connectivity'
import {
  applyResize, angleTo, clampPlacement, editorCapabilities, normalizeAngle, sizeBounds,
  type Placement, type SizeBounds,
} from '../../src/components/inventory/positionEditor'

function decoration(props?: ApiRoomDecorationDef['props']): ApiRoomDecorationDef {
  return { _id: 'd1', type: 'wallGraffiti', props }
}

const GEOMETRY = {
  x: { type: 'range' as const, default: 0 },
  y: { type: 'range' as const, default: 0 },
  width: { type: 'range' as const, default: 4 },
  height: { type: 'range' as const, default: 4 },
  rotation: { type: 'range' as const, default: 0 },
}

const FREE: SizeBounds = { minWidth: 1, maxWidth: 25, minHeight: 1, maxHeight: 25 }

function placement(partial: Partial<Placement> = {}): Placement {
  return { x: 10, y: 10, width: 4, height: 4, rotation: 0, ...partial }
}

describe('editorCapabilities()', () => {
  it('reads each capability off the schema', () => {
    expect(editorCapabilities(decoration(GEOMETRY))).toEqual({
      positionable: true, resizable: true, rotatable: true, proportional: false,
    })
  })

  it('turns a capability off when its property is read-only', () => {
    const caps = editorCapabilities(decoration({ ...GEOMETRY, rotation: { type: 'range', readonly: true } }))
    expect(caps.rotatable).toBe(false)
    expect(caps.positionable).toBe(true)
  })

  it('turns everything off when the schema is missing', () => {
    expect(editorCapabilities(decoration())).toMatchObject({
      positionable: false, resizable: false, rotatable: false,
    })
  })

  it('picks up the proportional flag', () => {
    expect(editorCapabilities(decoration({ ...GEOMETRY, proportional: true })).proportional).toBe(true)
  })
})

describe('sizeBounds()', () => {
  it('falls back to 1…25 when the schema is silent', () => {
    expect(sizeBounds(decoration())).toEqual(FREE)
  })

  it('uses the schema limits when present', () => {
    expect(sizeBounds(decoration({ minWidth: 2, maxWidth: 8, minHeight: 3, maxHeight: 9 })))
      .toEqual({ minWidth: 2, maxWidth: 8, minHeight: 3, maxHeight: 9 })
  })
})

describe('clampPlacement()', () => {
  it('lets a decoration hang off the top-left as long as one cell stays inside', () => {
    expect(clampPlacement(placement({ x: -3, y: -3 }), FREE)).toMatchObject({ x: -3, y: -3 })
  })

  it('stops it leaving the room entirely', () => {
    // width 4 → the origin may not go below 1 - 4 = -3.
    expect(clampPlacement(placement({ x: -10, y: -10 }), FREE)).toMatchObject({ x: -3, y: -3 })
  })

  it('keeps the origin inside the far edge', () => {
    expect(clampPlacement(placement({ x: 80, y: 80 }), FREE)).toMatchObject({ x: 49, y: 49 })
  })

  it('clamps the size to the bounds', () => {
    const bounds: SizeBounds = { minWidth: 2, maxWidth: 6, minHeight: 2, maxHeight: 6 }
    expect(clampPlacement(placement({ width: 99, height: 0 }), bounds)).toMatchObject({ width: 6, height: 2 })
  })
})

describe('applyResize()', () => {
  it('grows from the east handle without moving the origin', () => {
    expect(applyResize(placement(), 'e', 3, 0, FREE, false)).toMatchObject({ x: 10, width: 7, height: 4 })
  })

  it('moves the origin when dragging a west handle so the far edge stays put', () => {
    const out = applyResize(placement(), 'w', -2, 0, FREE, false)
    expect(out).toMatchObject({ x: 8, width: 6 })
    expect(out.x + out.width).toBe(14) // unchanged right edge
  })

  it('moves the origin when dragging a north handle', () => {
    const out = applyResize(placement(), 'n', 0, -2, FREE, false)
    expect(out).toMatchObject({ y: 8, height: 6 })
    expect(out.y + out.height).toBe(14)
  })

  it('resizes both axes from a corner', () => {
    expect(applyResize(placement(), 'se', 2, 4, FREE, false)).toMatchObject({ width: 6, height: 8 })
  })

  it('clamps to the size bounds', () => {
    const bounds: SizeBounds = { minWidth: 2, maxWidth: 5, minHeight: 1, maxHeight: 25 }
    expect(applyResize(placement(), 'e', 99, 0, bounds, false).width).toBe(5)
    expect(applyResize(placement(), 'e', -99, 0, bounds, false).width).toBe(2)
  })

  it('keeps a west-handle clamp anchored to the far edge', () => {
    const bounds: SizeBounds = { minWidth: 2, maxWidth: 5, minHeight: 1, maxHeight: 25 }
    const out = applyResize(placement(), 'w', -99, 0, bounds, false)
    expect(out.width).toBe(5)
    expect(out.x + out.width).toBe(14)
  })

  describe('proportional', () => {
    it('takes the smaller scale factor at a corner', () => {
      // width would scale 1.5x, height 2x → both end up at 1.5x.
      const out = applyResize(placement(), 'se', 2, 4, FREE, true)
      expect(out.width).toBeCloseTo(6)
      expect(out.height).toBeCloseTo(6)
    })

    it('lets an edge handle drive the scale on its own axis', () => {
      // Taking the minimum here would pin the ratio at 1 and make the handle inert.
      const out = applyResize(placement(), 'e', 4, 0, FREE, true)
      expect(out.width).toBeCloseTo(8)
      expect(out.height).toBeCloseTo(8)
    })

    it('holds the aspect ratio at the size limits', () => {
      const bounds: SizeBounds = { minWidth: 1, maxWidth: 6, minHeight: 1, maxHeight: 25 }
      const out = applyResize(placement({ width: 4, height: 2 }), 'se', 99, 99, bounds, true)
      expect(out.width).toBeCloseTo(6)
      expect(out.height).toBeCloseTo(3) // 2 × (6/4), aspect preserved
    })
  })
})

describe('angleTo() / normalizeAngle()', () => {
  it('measures from the frame centre, in radians', () => {
    expect(angleTo(0, 0, 1, 0)).toBeCloseTo(0)
    expect(angleTo(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2)
    expect(angleTo(0, 0, -1, 0)).toBeCloseTo(Math.PI)
  })

  it('wraps into (-π, π]', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(normalizeAngle(0)).toBe(0)
  })
})
