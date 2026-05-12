import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileStorage } from '../../src/storage/FileStorage.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'screeps-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('FileStorage', () => {
  it('returns null for missing key', async () => {
    const s = new FileStorage(tmpDir, 'ns')
    expect(await s.get('missing')).toBeNull()
  })

  it('stores and retrieves binary data', async () => {
    const s = new FileStorage(tmpDir, 'ns')
    const data = new Uint8Array([10, 20, 30, 40])
    await s.set('key', data)
    const result = await s.get('key')
    expect(result).toEqual(data)
  })

  it('delete removes the entry', async () => {
    const s = new FileStorage(tmpDir, 'ns')
    await s.set('key', new Uint8Array([1]))
    await s.delete('key')
    expect(await s.get('key')).toBeNull()
  })

  it('delete on missing key does not throw', async () => {
    const s = new FileStorage(tmpDir, 'ns')
    await expect(s.delete('missing')).resolves.toBeUndefined()
  })

  it('clear removes all entries for this namespace', async () => {
    const s = new FileStorage(tmpDir, 'ns')
    await s.set('a', new Uint8Array([1]))
    await s.set('b', new Uint8Array([2]))
    await s.clear()
    expect(await s.get('a')).toBeNull()
    expect(await s.get('b')).toBeNull()
  })

  it('namespaces are isolated', async () => {
    const s1 = new FileStorage(tmpDir, 'ns1')
    const s2 = new FileStorage(tmpDir, 'ns2')
    await s1.set('key', new Uint8Array([1]))
    expect(await s2.get('key')).toBeNull()
  })

  it('sanitizes URL-style namespace for directory name', async () => {
    const s = new FileStorage(tmpDir, 'https://screeps.com')
    await s.set('key', new Uint8Array([99]))
    expect(await s.get('key')).toEqual(new Uint8Array([99]))
  })
})
