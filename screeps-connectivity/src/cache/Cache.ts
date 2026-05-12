import type { StorageAdapter } from '../storage/StorageAdapter.js'

interface MemoryEntry {
  data: unknown
  expires?: number
}

export class Cache {
  private readonly memory = new Map<string, MemoryEntry>()
  private readonly storage: StorageAdapter | null
  private readonly namespace: string

  constructor(namespace: string, storage: StorageAdapter | null) {
    this.namespace = namespace
    this.storage = storage
  }

  private memKey(key: string): string {
    return `${this.namespace}/${key}`
  }

  get<T>(key: string): T | undefined {
    const entry = this.memory.get(this.memKey(key))
    if (!entry) return undefined
    if (entry.expires !== undefined && Date.now() > entry.expires) {
      this.memory.delete(this.memKey(key))
      return undefined
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.memory.set(this.memKey(key), {
      data,
      expires: ttlMs !== undefined ? Date.now() + ttlMs : undefined,
    })
  }

  delete(key: string): void {
    this.memory.delete(this.memKey(key))
  }

  async getPersistent(key: string): Promise<Uint8Array | null> {
    if (!this.storage) return null
    return this.storage.get(`${this.namespace}/${key}`)
  }

  async setPersistent(key: string, data: Uint8Array): Promise<void> {
    if (!this.storage) return
    await this.storage.set(`${this.namespace}/${key}`, data)
  }

  async deletePersistent(key: string): Promise<void> {
    if (!this.storage) return
    await this.storage.delete(`${this.namespace}/${key}`)
  }

  async clearPersistent(): Promise<void> {
    if (!this.storage) return
    await this.storage.clear()
  }
}
