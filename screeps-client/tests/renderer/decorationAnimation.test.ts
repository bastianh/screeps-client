import { describe, it, expect } from 'vitest'
import type { Container, Ticker } from 'pixi.js'
import { DecorationAnimator } from '../../src/renderer/decorationAnimation'

class FakeTicker {
  deltaMS = 0
  callbacks: Array<(ticker: FakeTicker) => void> = []

  add(fn: (ticker: FakeTicker) => void): void {
    this.callbacks.push(fn)
  }

  remove(fn: (ticker: FakeTicker) => void): void {
    this.callbacks = this.callbacks.filter(cb => cb !== fn)
  }

  /** Advance by `seconds`, in a single frame. */
  advance(seconds: number): void {
    this.deltaMS = seconds * 1000
    for (const cb of [...this.callbacks]) cb(this)
  }
}

function setup() {
  const ticker = new FakeTicker()
  const target = { alpha: 1, destroyed: false }
  const animator = new DecorationAnimator(ticker as unknown as Ticker)
  return { ticker, target, animator, container: target as unknown as Container }
}

describe('DecorationAnimator', () => {
  it('tweens linearly towards each step target', () => {
    const { ticker, target, animator, container } = setup()
    animator.add(container, 'fast') // [[0.3, 1.0], [1.0, 1.0]]

    ticker.advance(0.5)
    expect(target.alpha).toBeCloseTo(0.65) // halfway from 1.0 to 0.3

    ticker.advance(0.5)
    expect(target.alpha).toBeCloseTo(0.3) // step complete

    ticker.advance(0.5)
    expect(target.alpha).toBeCloseTo(0.65) // halfway back from 0.3 to 1.0
  })

  it('loops the sequence forever', () => {
    const { ticker, target, animator, container } = setup()
    animator.add(container, 'fast')

    ticker.advance(1) // → 0.3
    ticker.advance(1) // → 1.0, wraps to step 0
    expect(target.alpha).toBeCloseTo(1)

    ticker.advance(0.5)
    expect(target.alpha).toBeCloseTo(0.65) // on its way to 0.3 again
  })

  it('holds when a step targets the alpha it already has', () => {
    const { ticker, target, animator, container } = setup()
    animator.add(container, 'flash') // [[1.0, 0.1], [0.0, 1.5], [0.0, 2]]

    ticker.advance(0.1) // → 1.0
    ticker.advance(1.5) // → 0.0
    expect(target.alpha).toBeCloseTo(0)

    ticker.advance(1) // third step holds at 0
    expect(target.alpha).toBeCloseTo(0)
  })

  it('only subscribes to the ticker once and unsubscribes on destroy', () => {
    const { ticker, animator, container } = setup()
    animator.add(container, 'slow')
    animator.add(container, 'fast')
    expect(ticker.callbacks).toHaveLength(1)

    animator.destroy()
    expect(ticker.callbacks).toHaveLength(0)
  })

  it('skips destroyed targets', () => {
    const { ticker, target, animator, container } = setup()
    animator.add(container, 'fast')
    target.destroyed = true

    ticker.advance(0.5)
    expect(target.alpha).toBe(1)
  })
})
