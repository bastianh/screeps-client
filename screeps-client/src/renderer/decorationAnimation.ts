import type { Container, Ticker } from 'pixi.js'
import type { DecorationAnimation } from './roomDecorations.js'

// Alpha keyframes of the reference renderer (src/lib/decorations.js), as
// `[target alpha, seconds]`. Each step tweens linearly from the previous alpha;
// the whole sequence repeats forever.
const ANIMATION_STEPS: Record<DecorationAnimation, ReadonlyArray<readonly [number, number]>> = {
  slow: [[0.3, 5.0], [1.0, 5.0]],
  fast: [[0.3, 1.0], [1.0, 1.0]],
  blink: [[0.8, 2.0], [1.0, 0.1], [0.6, 4.0], [1.0, 0.1], [0.7, 1.0], [1.0, 0.1]],
  neon: [
    [1.0, 1.0], [0.95, 0.07], [1.0, 0.07], [1.0, 0.07], [0.9, 0.07], [1.0, 0.07],
    [0.7, 0.07], [1.0, 0.07], [1.0, 0.1], [0.9, 0.07], [1.0, 0.07],
    [1.0, 1.0], [0.95, 0.07], [1.0, 0.07], [1.0, 0.07], [0.9, 0.07], [1.0, 0.07],
  ],
  flash: [[1.0, 0.1], [0.0, 1.5], [0.0, 2]],
}

interface Tween {
  target: Container
  steps: ReadonlyArray<readonly [number, number]>
  index: number
  elapsed: number
  from: number
}

/**
 * Drives the alpha animations of decoration sprites off a single ticker callback.
 *
 * The animated node must own its alpha exclusively — put static alphas (the item's
 * own `alpha`, a graphic's alpha prop) on a parent container instead, so the two
 * multiply rather than overwrite each other.
 */
export class DecorationAnimator {
  private readonly ticker: Ticker
  private tweens: Tween[] = []
  private running = false
  private readonly onTick = (ticker: Ticker) => this.update(ticker.deltaMS / 1000)

  constructor(ticker: Ticker) {
    this.ticker = ticker
  }

  add(target: Container, animation: DecorationAnimation): void {
    const steps = ANIMATION_STEPS[animation]
    this.tweens.push({ target, steps, index: 0, elapsed: 0, from: target.alpha })
    if (!this.running) {
      this.ticker.add(this.onTick)
      this.running = true
    }
  }

  destroy(): void {
    if (this.running) {
      this.ticker.remove(this.onTick)
      this.running = false
    }
    this.tweens.length = 0
  }

  private update(dt: number): void {
    // Object overlays are rebuilt whenever the decoration list or a creep's spawning
    // state changes, so dead tweens have to be reaped or the list grows without bound.
    let reap = false

    for (const tween of this.tweens) {
      if (tween.target.destroyed) {
        reap = true
        continue
      }
      const [to, duration] = tween.steps[tween.index]
      tween.elapsed += dt

      if (duration <= 0 || tween.elapsed >= duration) {
        tween.target.alpha = to
        tween.index = (tween.index + 1) % tween.steps.length
        tween.elapsed = 0
        tween.from = to
        continue
      }

      tween.target.alpha = tween.from + (to - tween.from) * (tween.elapsed / duration)
    }

    if (reap) this.tweens = this.tweens.filter(t => !t.target.destroyed)
  }
}
