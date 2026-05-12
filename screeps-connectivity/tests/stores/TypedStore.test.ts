import { describe, it, expect, vi } from 'vitest'
import { TypedStore } from '../../src/stores/TypedStore.js'

interface TestEvents {
  'test:event': { value: number }
  'test:other': { name: string }
}

describe('TypedStore', () => {
  it('delivers typed event detail to listener', () => {
    const store = new TypedStore<TestEvents>()
    const handler = vi.fn()
    store.on('test:event', handler)
    store.emit('test:event', { value: 42 })
    expect(handler).toHaveBeenCalledWith({ value: 42 })
  })

  it('dispose() removes the listener', () => {
    const store = new TypedStore<TestEvents>()
    const handler = vi.fn()
    const sub = store.on('test:event', handler)
    sub.dispose()
    store.emit('test:event', { value: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('multiple listeners on the same event all fire', () => {
    const store = new TypedStore<TestEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    store.on('test:event', h1)
    store.on('test:event', h2)
    store.emit('test:event', { value: 7 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('listeners on different events do not cross-fire', () => {
    const store = new TypedStore<TestEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    store.on('test:event', h1)
    store.on('test:other', h2)
    store.emit('test:event', { value: 1 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).not.toHaveBeenCalled()
  })

  it('on() returns a Subscription compatible with SubscriptionGroup', () => {
    const store = new TypedStore<TestEvents>()
    const sub = store.on('test:event', vi.fn())
    expect(typeof sub.dispose).toBe('function')
  })
})
