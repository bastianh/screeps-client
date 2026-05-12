import { describe, it, expect } from 'vitest'
import { NullStorage } from '../../src/storage/NullStorage.js'

describe('NullStorage', () => {
  it('get always returns null', async () => {
    const s = new NullStorage()
    expect(await s.get('key')).toBeNull()
  })

  it('set is a no-op and does not throw', async () => {
    const s = new NullStorage()
    await expect(s.set('key', new Uint8Array([1, 2]))).resolves.toBeUndefined()
  })

  it('delete is a no-op and does not throw', async () => {
    const s = new NullStorage()
    await expect(s.delete('key')).resolves.toBeUndefined()
  })

  it('clear is a no-op and does not throw', async () => {
    const s = new NullStorage()
    await expect(s.clear()).resolves.toBeUndefined()
  })
})
