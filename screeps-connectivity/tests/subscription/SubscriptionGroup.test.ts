import { describe, it, expect, vi } from 'vitest'
import { SubscriptionGroup } from '../../src/subscription/index.js'

describe('SubscriptionGroup', () => {
  it('calls dispose on all added subscriptions', () => {
    const group = new SubscriptionGroup()
    const d1 = vi.fn()
    const d2 = vi.fn()
    group.add({ dispose: d1 })
    group.add({ dispose: d2 })
    group.dispose()
    expect(d1).toHaveBeenCalledOnce()
    expect(d2).toHaveBeenCalledOnce()
  })

  it('clears internal list after dispose so second dispose is a no-op', () => {
    const group = new SubscriptionGroup()
    const d1 = vi.fn()
    group.add({ dispose: d1 })
    group.dispose()
    group.dispose()
    expect(d1).toHaveBeenCalledOnce()
  })

  it('itself satisfies the Subscription interface', () => {
    const outer = new SubscriptionGroup()
    const inner = new SubscriptionGroup()
    const d = vi.fn()
    inner.add({ dispose: d })
    outer.add(inner)
    outer.dispose()
    expect(d).toHaveBeenCalledOnce()
  })
})
