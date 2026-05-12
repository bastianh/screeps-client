import { mkdir, readFile, writeFile, unlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { StorageAdapter } from './StorageAdapter.js'

export class FileStorage implements StorageAdapter {
  private readonly dir: string

  constructor(baseDir: string, namespace: string) {
    const sanitized = namespace.replace(/[^a-zA-Z0-9.-]/g, '_')
    this.dir = join(baseDir, sanitized)
  }

  private keyPath(key: string): string {
    const hex = Buffer.from(key).toString('hex')
    return join(this.dir, `${hex}.bin`)
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const buf = await readFile(this.keyPath(key))
      return new Uint8Array(buf)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.keyPath(key), data)
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.keyPath(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true })
  }
}
