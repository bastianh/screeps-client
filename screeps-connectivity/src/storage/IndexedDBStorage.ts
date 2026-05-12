import type { StorageAdapter } from './StorageAdapter.js'

const DB_VERSION = 1
const STORE_NAME = 'data'

export class IndexedDBStorage implements StorageAdapter {
  private readonly namespace: string
  private db: IDBDatabase | null = null
  private openPromise: Promise<IDBDatabase> | null = null

  constructor(namespace: string) {
    this.namespace = namespace
  }

  private get dbName(): string {
    return `screeps:${this.namespace}`
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (this.openPromise) return this.openPromise
    this.openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME)
      }
      req.onsuccess = () => {
        this.db = req.result
        this.openPromise = null
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error(`IndexedDB open blocked: ${this.dbName}`))
    })
    return this.openPromise
  }

  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(data, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async delete(key: string): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async clear(): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}
