import type { StorageAdapter } from './StorageAdapter.js'

export class NullStorage implements StorageAdapter {
  async get(_key: string): Promise<Uint8Array | null> { return null }
  async set(_key: string, _data: Uint8Array): Promise<void> {}
  async delete(_key: string): Promise<void> {}
  async clear(): Promise<void> {}
}
