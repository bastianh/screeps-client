import { describe, it, expect, vi } from 'vitest'
import { Cache } from '../../src/cache/Cache.js'
import { NullStorage } from '../../src/storage/NullStorage.js'

describe('Cache — memory tier', () => {
  it('stores and retrieves a value', () => {
    const cache = new Cache('ns', null)
    cache.set('key', { x: 1 })
    expect(cache.get('key')).toEqual({ x: 1 })
  })

  it('returns undefined for missing key', () => {
    const cache = new Cache('ns', null)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('expires entries after TTL', async () => {
    const cache = new Cache('ns', null)
    cache.set('key', 'val', 1)
    await new Promise(r => setTimeout(r, 10))
    expect(cache.get('key')).toBeUndefined()
  })

  it('does not expire entries without TTL', async () => {
    const cache = new Cache('ns', null)
    cache.set('key', 'val')
    await new Promise(r => setTimeout(r, 10))
    expect(cache.get('key')).toBe('val')
  })

  it('namespaces are isolated', () => {
    const c1 = new Cache('ns1', null)
    const c2 = new Cache('ns2', null)
    c1.set('key', 'from-ns1')
    expect(c2.get('key')).toBeUndefined()
  })

  it('delete removes entry', () => {
    const cache = new Cache('ns', null)
    cache.set('key', 'val')
    cache.delete('key')
    expect(cache.get('key')).toBeUndefined()
  })
})

describe('Cache — persistent tier', () => {
  it('delegates getPersistent with namespaced key', async () => {
    const storage = new NullStorage()
    const spy = vi.spyOn(storage, 'get').mockResolvedValue(null)
    const cache = new Cache('myns', storage)
    await cache.getPersistent('terrain/W7N7')
    expect(spy).toHaveBeenCalledWith('myns/terrain/W7N7')
  })

  it('delegates setPersistent with namespaced key', async () => {
    const storage = new NullStorage()
    const spy = vi.spyOn(storage, 'set').mockResolvedValue()
    const cache = new Cache('myns', storage)
    const data = new Uint8Array([1, 2, 3])
    await cache.setPersistent('terrain/W7N7', data)
    expect(spy).toHaveBeenCalledWith('myns/terrain/W7N7', data)
  })

  it('returns null when storage is null', async () => {
    const cache = new Cache('ns', null)
    expect(await cache.getPersistent('key')).toBeNull()
  })

  it('setPersistent is a no-op when storage is null', async () => {
    const cache = new Cache('ns', null)
    await expect(cache.setPersistent('key', new Uint8Array([1]))).resolves.toBeUndefined()
  })

  it('deletePersistent delegates to adapter', async () => {
    const adapter = new NullStorage()
    const spy = vi.spyOn(adapter, 'delete').mockResolvedValue(undefined)
    const cache = new Cache('myns', adapter)
    await cache.deletePersistent('terrain/W7N7')
    expect(spy).toHaveBeenCalledWith('myns/terrain/W7N7')
  })

  it('clearPersistent delegates to adapter', async () => {
    const adapter = new NullStorage()
    const spy = vi.spyOn(adapter, 'clear').mockResolvedValue(undefined)
    const cache = new Cache('myns', adapter)
    await cache.clearPersistent()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('deletePersistent is a no-op when storage is null', async () => {
    const cache = new Cache('myns', null)
    await expect(cache.deletePersistent('key')).resolves.toBeUndefined()
  })

  it('clearPersistent is a no-op when storage is null', async () => {
    const cache = new Cache('myns', null)
    await expect(cache.clearPersistent()).resolves.toBeUndefined()
  })
})
