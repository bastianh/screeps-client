import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IndexedDBStorage } from '../../src/storage/IndexedDBStorage.js'

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage

  beforeEach(() => {
    storage = new IndexedDBStorage(`test-ns-${Math.random()}`)
  })

  it('returns null for missing key', async () => {
    expect(await storage.get('missing')).toBeNull()
  })

  it('stores and retrieves binary data', async () => {
    const data = new Uint8Array([1, 2, 3, 4])
    await storage.set('mykey', data)
    const result = await storage.get('mykey')
    expect(result).toEqual(data)
  })

  it('delete removes the entry', async () => {
    await storage.set('key', new Uint8Array([7]))
    await storage.delete('key')
    expect(await storage.get('key')).toBeNull()
  })

  it('clear removes all entries', async () => {
    await storage.set('a', new Uint8Array([1]))
    await storage.set('b', new Uint8Array([2]))
    await storage.clear()
    expect(await storage.get('a')).toBeNull()
    expect(await storage.get('b')).toBeNull()
  })
})
