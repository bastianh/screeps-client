import { describe, it, expect } from 'vitest'
import { parseExpression, resolveProp, type ExprParams } from './expressions.js'

function params(over: Partial<ExprParams> = {}): ExprParams {
  return { state: {}, calcs: {}, firstRun: true, ...over }
}

describe('resolveProp', () => {
  it('walks dotted and bracketed paths', () => {
    const obj = { a: { b: [{ c: 7 }] } }
    expect(resolveProp(obj, 'a.b[0].c')).toBe(7)
    expect(resolveProp(obj, 'a.b.0.c')).toBe(7)
  })

  it('treats ^ as the object itself', () => {
    const obj = { a: 1 }
    expect(resolveProp(obj, '^')).toBe(obj)
  })

  it('returns undefined for missing and for paths through primitives', () => {
    expect(resolveProp({ a: 1 }, 'b.c')).toBeUndefined()
    expect(resolveProp({ a: 1 }, 'a.b')).toBeUndefined()
    expect(resolveProp(undefined, 'a')).toBeUndefined()
  })
})

describe('expression engine', () => {
  it('passes literals and arrays through', () => {
    expect(parseExpression(5, params())).toBe(5)
    expect(parseExpression('x', params())).toBe('x')
    expect(parseExpression(null, params())).toBeNull()
    expect(parseExpression([1, 'a'], params())).toEqual([1, 'a'])
  })

  it('evaluates values of a plain object without treating it as an operator', () => {
    const result = parseExpression(
      { align: 'center', fill: { $state: 'color' } },
      params({ state: { color: '#ff0000' } }),
    )
    expect(result).toEqual({ align: 'center', fill: '#ff0000' })
  })

  it('reads state, with default and koef modifiers', () => {
    expect(parseExpression({ $state: 'counter' }, params({ state: { counter: 3 } }))).toBe(3)
    expect(parseExpression({ $state: 'missing', default: 9 }, params())).toBe(9)
    expect(parseExpression({ $state: 'counter', koef: 10 }, params({ state: { counter: 3 } }))).toBe(30)
    // koef applies to the default too, since it lands on the numeric path.
    expect(parseExpression({ $state: 'missing', default: 2, koef: 3 }, params())).toBe(6)
  })

  it('reads calcs, processor params and the target object', () => {
    expect(parseExpression({ $calc: 'radius' }, params({ calcs: { radius: 12 } }))).toBe(12)
    expect(parseExpression({ $processorParam: 'tickDuration' }, params({ tickDuration: 500 }))).toBe(500)
    expect(parseExpression({ $rel: 'scale.x' }, params({ target: { scale: { x: 2 } } }))).toBe(2)
    expect(parseExpression({ $stateExtra: 'gameTime' }, params({ stateExtra: { gameTime: 42 } }))).toBe(42)
  })

  it('evaluates arithmetic', () => {
    expect(parseExpression({ $add: [1, 2, 3] }, params())).toBe(6)
    expect(parseExpression({ $sub: [10, 3, 2] }, params())).toBe(5)
    expect(parseExpression({ $mul: [2, 3, 4] }, params())).toBe(24)
    expect(parseExpression({ $div: [10, 4] }, params())).toBe(2.5)
    expect(parseExpression({ $min: [3, 1, 2] }, params())).toBe(1)
    expect(parseExpression({ $max: [3, 1, 2] }, params())).toBe(3)
  })

  it('evaluates comparisons and logic', () => {
    expect(parseExpression({ $gt: [2, 1] }, params())).toBe(true)
    expect(parseExpression({ $gte: [2, 2] }, params())).toBe(true)
    expect(parseExpression({ $lt: [1, 2] }, params())).toBe(true)
    expect(parseExpression({ $lte: [3, 2] }, params())).toBe(false)
    expect(parseExpression({ $and: [true, 1] }, params())).toBe(true)
    expect(parseExpression({ $or: [false, 0] }, params())).toBe(false)
    expect(parseExpression({ $not: false }, params())).toBe(true)
  })

  it('compares loosely, matching the reference renderer', () => {
    expect(parseExpression({ $eq: [{ $state: 'x' }, '10'] }, params({ state: { x: 10 } }))).toBe(true)
  })

  it('selects a branch with $if', () => {
    const p = params({ state: { hasGift: true } })
    expect(parseExpression({ $if: { $state: 'hasGift' }, then: 1.0, else: 0.5 }, p)).toBe(1.0)
    expect(parseExpression({ $if: { $state: 'nope' }, then: 1.0, else: 0.5 }, p)).toBe(0.5)
    // Bare $if defaults to a boolean.
    expect(parseExpression({ $if: false }, p)).toBe(false)
  })

  it('concatenates and indexes', () => {
    expect(parseExpression({ $concat: ['a', 1, 'b'] }, params())).toBe('a1b')
    expect(parseExpression({ $idx: [['x', 'y'], 1] }, params())).toBe('y')
    expect(parseExpression({ $idx: [null, 0] }, params())).toBeUndefined()
  })

  it('evaluates the score-radius calculation from the stock draw-parameterized mod', () => {
    // 40 * score / scoreMax — reference/renderer example-mods renderer/draw-parameterized.js
    const expr = {
      $mul: [40, { $div: [{ $state: 'score' }, { $state: 'scoreMax' }] }],
    }
    expect(parseExpression(expr, params({ state: { score: 30, scoreMax: 100 } }))).toBe(12)
  })

  it('nests operators inside payload values', () => {
    const payload = {
      texture: 'glow',
      alpha: { $if: { $state: 'hasGift' }, then: 1.0, else: 0.5 },
      width: { $mul: [{ $state: 'size' }, 2] },
    }
    expect(parseExpression(payload, params({ state: { hasGift: false, size: 50 } })))
      .toEqual({ texture: 'glow', alpha: 0.5, width: 100 })
  })
})
