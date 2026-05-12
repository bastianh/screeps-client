# screeps-connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `screeps-connectivity`, a zero-dependency TypeScript library providing HTTP connectivity, WebSocket management, two-tier caching, and typed reactive data stores for a Screeps client.

**Architecture:** Five layers — `HttpClient` (fetch + auth + rate limits), `SocketClient` (WebSocket + reconnect + subscriptions), `DataStores` (typed EventTarget-based reactive state), `Cache` (in-memory + optional persistent), and `StorageAdapter` implementations — wired together by a `ScreepsClient` facade. Works natively in browser, Tauri, and Node.js 22+ using only platform-native APIs (`fetch`, `WebSocket`, `DecompressionStream`).

**Tech Stack:** TypeScript 5.x strict, tsup (build), Vitest (tests), ESLint + @typescript-eslint (lint). Zero production dependencies.

---

## File Map

```
screeps-connectivity/
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  src/
    index.ts
    ScreepsClient.ts
    types/
      game.ts          — TerrainType, RoomTerrain, RoomObject, UserInfo, CpuStats, ConsoleMessage, ServerVersion, ShardInfo, Badge
      api.ts           — REST response shapes
      events.ts        — RoomStoreEvents, UserStoreEvents, ServerStoreEvents
    subscription/
      index.ts         — Subscription interface + SubscriptionGroup class
    storage/
      StorageAdapter.ts
      NullStorage.ts
      IndexedDBStorage.ts
      FileStorage.ts
    cache/
      Cache.ts
    http/
      decompress.ts    — decompressGzip / decompressZlib via DecompressionStream
      HttpClient.ts
      auth/
        AuthStrategy.ts
        TokenAuth.ts
        PasswordAuth.ts
      endpoints/
        auth.ts
        game.ts
        user.ts
        leaderboard.ts
        experimental.ts
    socket/
      MessageParser.ts
      SocketClient.ts
    stores/
      TypedStore.ts
      RoomStore.ts
      UserStore.ts
      ServerStore.ts
  tests/
    subscription/SubscriptionGroup.test.ts
    storage/NullStorage.test.ts
    storage/FileStorage.test.ts
    storage/IndexedDBStorage.test.ts
    cache/Cache.test.ts
    http/decompress.test.ts
    http/HttpClient.test.ts
    http/endpoints/auth.test.ts
    http/endpoints/game.test.ts
    socket/MessageParser.test.ts
    socket/SocketClient.test.ts
    stores/TypedStore.test.ts
    stores/RoomStore.test.ts
    stores/UserStore.test.ts
    stores/ServerStore.test.ts
    ScreepsClient.test.ts
```

---

## Task 1: Project scaffold

**Files:**
- Create: `screeps-connectivity/package.json`
- Create: `screeps-connectivity/tsconfig.json`
- Create: `screeps-connectivity/tsup.config.ts`
- Create: `screeps-connectivity/vitest.config.ts`

- [ ] **Step 1: Create the package directory and package.json**

```bash
mkdir -p screeps-connectivity/src screeps-connectivity/tests
```

`screeps-connectivity/package.json`:
```json
{
  "name": "screeps-connectivity",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "fake-indexeddb": "^6.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`screeps-connectivity/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tsup.config.ts and vitest.config.ts**

`screeps-connectivity/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
})
```

`screeps-connectivity/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Install dependencies**

```bash
cd screeps-connectivity && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Verify TypeScript is available**

```bash
cd screeps-connectivity && npx tsc --version
```

Expected: `Version 5.x.x`

- [ ] **Step 6: Create empty src/index.ts and verify build works**

`screeps-connectivity/src/index.ts`:
```ts
// exports added incrementally
```

```bash
cd screeps-connectivity && npm run build
```

Expected: `dist/` created with `index.js`, `index.cjs`, `index.d.ts`.

- [ ] **Step 7: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: scaffold screeps-connectivity package"
```

---

## Task 2: Core types

**Files:**
- Create: `screeps-connectivity/src/types/game.ts`
- Create: `screeps-connectivity/src/types/api.ts`
- Create: `screeps-connectivity/src/types/events.ts`
- Test: `screeps-connectivity/tests/types/game.test.ts`

- [ ] **Step 1: Write failing tests for RoomTerrain**

`screeps-connectivity/tests/types/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RoomTerrain, TerrainType } from '../../src/types/game.js'

describe('RoomTerrain', () => {
  it('parses plain, wall, swamp from encoded string', () => {
    const encoded = '012' + '0'.repeat(2497)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
    expect(terrain.get(1, 0)).toBe(TerrainType.Wall)
    expect(terrain.get(2, 0)).toBe(TerrainType.Swamp)
  })

  it('normalizes value 3 to Wall', () => {
    const encoded = '3' + '0'.repeat(2499)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    expect(terrain.get(0, 0)).toBe(TerrainType.Wall)
  })

  it('maps (x, y) to index y*50+x', () => {
    // tile at x=0, y=1 is index 50
    const chars = Array(2500).fill('0')
    chars[50] = '1'
    const terrain = RoomTerrain.fromEncodedString(chars.join(''))
    expect(terrain.get(0, 1)).toBe(TerrainType.Wall)
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
  })

  it('exposes raw Uint8Array of length 2500', () => {
    const terrain = RoomTerrain.fromEncodedString('0'.repeat(2500))
    expect(terrain.raw).toBeInstanceOf(Uint8Array)
    expect(terrain.raw.length).toBe(2500)
  })

  it('round-trips through raw bytes', () => {
    const encoded = '012' + '0'.repeat(2497)
    const terrain = RoomTerrain.fromEncodedString(encoded)
    const restored = new RoomTerrain(terrain.raw)
    expect(restored.get(0, 0)).toBe(TerrainType.Plain)
    expect(restored.get(1, 0)).toBe(TerrainType.Wall)
    expect(restored.get(2, 0)).toBe(TerrainType.Swamp)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/types/game.test.ts
```

Expected: FAIL — `Cannot find module '../../src/types/game.js'`

- [ ] **Step 3: Create src/types/game.ts**

`screeps-connectivity/src/types/game.ts`:
```ts
export enum TerrainType {
  Plain = 0,
  Wall = 1,
  Swamp = 2,
}

export class RoomTerrain {
  readonly raw: Uint8Array

  constructor(data: Uint8Array) {
    this.raw = data
  }

  get(x: number, y: number): TerrainType {
    return this.raw[y * 50 + x] as TerrainType
  }

  static fromEncodedString(encoded: string): RoomTerrain {
    const data = new Uint8Array(2500)
    for (let i = 0; i < 2500; i++) {
      const v = parseInt(encoded[i], 10)
      data[i] = v === 3 ? TerrainType.Wall : (v as TerrainType)
    }
    return new RoomTerrain(data)
  }
}

export interface Badge {
  type: number | { path1: string; path2: string }
  color1: string
  color2: string
  color3: string
  param: number
  flip: boolean
}

export interface RoomObject {
  _id: string
  type: string
  room: string
  x: number
  y: number
  [key: string]: unknown
}

export type RoomObjectMap = Record<string, RoomObject>

export interface UserInfo {
  _id: string
  username: string
  email: string
  cpu: number
  gcl: number
  credits: number
  badge: Badge
}

export interface CpuStats {
  cpu: number
  memory: number
}

export interface ConsoleMessage {
  log: string[]
  results: string[]
}

export interface ServerVersion {
  ok: number
  package: number
  protocol: number
  users: number
  serverData: {
    historyChunkSize: number
    features: Array<{ name: string }>
    shards: string[]
  }
}

export interface ShardInfo {
  name: string
  lastTicks: number[]
  cpuLimit: number
  rooms: number
  users: number
  tick: number
}
```

- [ ] **Step 4: Create src/types/api.ts**

`screeps-connectivity/src/types/api.ts`:
```ts
export interface ApiOkResponse {
  ok: number
}

export interface ApiAuthSigninResponse {
  ok: number
  token: string
}

export interface ApiAuthMeResponse {
  ok: number
  _id: string
  email: string
  username: string
  cpu: number
  gcl: number
  credits: number
  badge: unknown
  password: boolean
}

export interface ApiAuthQueryTokenResponse {
  ok: number
  token: { full: boolean }
}

export interface ApiRoomTerrainResponse {
  ok: number
  terrain: Array<{
    _id: string
    room: string
    terrain: string
    type: string
  }>
}

export interface ApiRoomObjectsResponse {
  ok: number
  objects: unknown[]
  users: Record<string, unknown>
}

export interface ApiVersionResponse {
  ok: number
  package: number
  protocol: number
  users: number
  serverData: {
    historyChunkSize: number
    features: Array<{ name: string }>
    shards: string[]
    customObjectTypes?: unknown
  }
}

export interface ApiShardsInfoResponse {
  ok: number
  shards: Array<{
    name: string
    lastTicks: number[]
    cpuLimit: number
    rooms: number
    users: number
    tick: number
  }>
}

export interface ApiUserBranchesResponse {
  ok: number
  list: Array<{
    _id: string
    branch: string
    activeWorld: boolean
    activeSim: boolean
  }>
}

export interface ApiLeaderboardListResponse {
  ok: number
  list: Array<{ _id: string; season: string; user: string; score: number; rank: number }>
  count: number
  users: Record<string, { _id: string; username: string; badge: unknown; gcl: number }>
}

export interface ApiLeaderboardSeasonsResponse {
  ok: number
  seasons: Array<{ _id: string; name: string; date: string }>
}
```

- [ ] **Step 5: Create src/types/events.ts**

`screeps-connectivity/src/types/events.ts`:
```ts
import type { RoomObjectMap, RoomTerrain, CpuStats, ConsoleMessage } from './game.js'

export interface RoomStoreEvents {
  'room:update': { room: string; shard: string; gameTime: number; objects: RoomObjectMap }
  'room:terrainavailable': { room: string; shard: string; terrain: RoomTerrain }
}

export interface UserStoreEvents {
  'user:cpu': CpuStats
  'user:console': { messages: ConsoleMessage }
  'user:code': { branch: string; modules: Record<string, string> }
}

export interface ServerStoreEvents {
  'server:connected': Record<string, never>
  'server:disconnected': { willReconnect: boolean }
  'server:error': { error: Error }
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/types/game.test.ts
```

Expected: 5 passing tests.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd screeps-connectivity && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add core types (game, api, events)"
```

---

## Task 3: Subscription + SubscriptionGroup

**Files:**
- Create: `screeps-connectivity/src/subscription/index.ts`
- Test: `screeps-connectivity/tests/subscription/SubscriptionGroup.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/subscription/SubscriptionGroup.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/subscription/SubscriptionGroup.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement src/subscription/index.ts**

`screeps-connectivity/src/subscription/index.ts`:
```ts
export interface Subscription {
  dispose(): void
}

export class SubscriptionGroup implements Subscription {
  private readonly subs: Subscription[] = []

  add(sub: Subscription): void {
    this.subs.push(sub)
  }

  dispose(): void {
    for (const sub of this.subs) {
      sub.dispose()
    }
    this.subs.length = 0
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/subscription/SubscriptionGroup.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add Subscription and SubscriptionGroup"
```

---

## Task 4: StorageAdapter interface + NullStorage

**Files:**
- Create: `screeps-connectivity/src/storage/StorageAdapter.ts`
- Create: `screeps-connectivity/src/storage/NullStorage.ts`
- Test: `screeps-connectivity/tests/storage/NullStorage.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/storage/NullStorage.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/storage/NullStorage.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create StorageAdapter.ts and NullStorage.ts**

`screeps-connectivity/src/storage/StorageAdapter.ts`:
```ts
export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>
  set(key: string, data: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}
```

`screeps-connectivity/src/storage/NullStorage.ts`:
```ts
import type { StorageAdapter } from './StorageAdapter.js'

export class NullStorage implements StorageAdapter {
  async get(_key: string): Promise<Uint8Array | null> { return null }
  async set(_key: string, _data: Uint8Array): Promise<void> {}
  async delete(_key: string): Promise<void> {}
  async clear(): Promise<void> {}
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/storage/NullStorage.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add StorageAdapter interface and NullStorage"
```

---

## Task 5: FileStorage

**Files:**
- Create: `screeps-connectivity/src/storage/FileStorage.ts`
- Test: `screeps-connectivity/tests/storage/FileStorage.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/storage/FileStorage.test.ts`:
```ts
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
    // Should not throw on URL-like namespace
    const s = new FileStorage(tmpDir, 'https://screeps.com')
    await s.set('key', new Uint8Array([99]))
    expect(await s.get('key')).toEqual(new Uint8Array([99]))
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/storage/FileStorage.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement FileStorage**

`screeps-connectivity/src/storage/FileStorage.ts`:
```ts
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
    const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, '_')
    return join(this.dir, `${sanitized}.bin`)
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const buf = await readFile(this.keyPath(key))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/storage/FileStorage.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add FileStorage adapter"
```

---

## Task 6: IndexedDBStorage

**Files:**
- Create: `screeps-connectivity/src/storage/IndexedDBStorage.ts`
- Test: `screeps-connectivity/tests/storage/IndexedDBStorage.test.ts`

- [ ] **Step 1: Write failing tests**

`fake-indexeddb` is already a dev dependency — it provides an in-memory IDB implementation for Node tests.

`screeps-connectivity/tests/storage/IndexedDBStorage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IndexedDBStorage } from '../../src/storage/IndexedDBStorage.js'

// fake-indexeddb patches globalThis.indexedDB before each import

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage

  beforeEach(() => {
    // Fresh namespace per test avoids cross-test bleed
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/storage/IndexedDBStorage.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement IndexedDBStorage**

`screeps-connectivity/src/storage/IndexedDBStorage.ts`:
```ts
import type { StorageAdapter } from './StorageAdapter.js'

const DB_VERSION = 1
const STORE_NAME = 'data'

export class IndexedDBStorage implements StorageAdapter {
  private readonly namespace: string
  private db: IDBDatabase | null = null

  constructor(namespace: string) {
    this.namespace = namespace
  }

  private get dbName(): string {
    return `screeps:${this.namespace}`
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME)
      }
      req.onsuccess = () => {
        this.db = req.result
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
    })
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/storage/IndexedDBStorage.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add IndexedDBStorage adapter"
```

---

## Task 7: Two-tier Cache

**Files:**
- Create: `screeps-connectivity/src/cache/Cache.ts`
- Test: `screeps-connectivity/tests/cache/Cache.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/cache/Cache.test.ts`:
```ts
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
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/cache/Cache.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement Cache**

`screeps-connectivity/src/cache/Cache.ts`:
```ts
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/cache/Cache.test.ts
```

Expected: 10 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add two-tier Cache"
```

---

## Task 8: Decompression utility

**Files:**
- Create: `screeps-connectivity/src/http/decompress.ts`
- Test: `screeps-connectivity/tests/http/decompress.test.ts`

- [ ] **Step 1: Write failing tests**

The server encodes `gz:` prefixed data as base64-encoded compressed bytes.
- HTTP responses: gzip format (`zlib.gunzip`)
- Socket messages: zlib/deflate format (`zlib.inflate`)

We generate test fixtures by compressing known data with Node's `zlib`.

`screeps-connectivity/tests/http/decompress.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createGzip, createDeflate } from 'node:zlib'
import { promisify } from 'node:util'
import { pipeline } from 'node:stream'
import { Readable } from 'node:stream'
import { decompressGzip, decompressZlib } from '../../src/http/decompress.js'

const pipelineAsync = promisify(pipeline)

async function gzipEncode(json: unknown): Promise<string> {
  const input = Buffer.from(JSON.stringify(json))
  const chunks: Buffer[] = []
  const gz = createGzip()
  await pipelineAsync(Readable.from(input), gz, async function*(source) {
    for await (const chunk of source) chunks.push(chunk as Buffer)
  })
  return 'gz:' + Buffer.concat(chunks).toString('base64')
}

async function zlibEncode(json: unknown): Promise<string> {
  const input = Buffer.from(JSON.stringify(json))
  const chunks: Buffer[] = []
  const def = createDeflate()
  await pipelineAsync(Readable.from(input), def, async function*(source) {
    for await (const chunk of source) chunks.push(chunk as Buffer)
  })
  return 'gz:' + Buffer.concat(chunks).toString('base64')
}

describe('decompressGzip', () => {
  it('decompresses a gzip-encoded gz: string', async () => {
    const payload = { message: 'hello', value: 42 }
    const encoded = await gzipEncode(payload)
    const result = await decompressGzip(encoded)
    expect(result).toEqual(payload)
  })
})

describe('decompressZlib', () => {
  it('decompresses a zlib-encoded gz: string', async () => {
    const payload = [{ channel: 'user:x/cpu', data: { cpu: 10 } }]
    const encoded = await zlibEncode(payload)
    const result = await decompressZlib(encoded)
    expect(result).toEqual(payload)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/http/decompress.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement decompress.ts**

`DecompressionStream` is available in Node 18+ and all modern browsers. `'gzip'` for HTTP responses; `'deflate'` for socket messages (zlib format).

`screeps-connectivity/src/http/decompress.ts`:
```ts
async function decompress(data: string, format: 'gzip' | 'deflate'): Promise<unknown> {
  const b64 = data.slice(3) // strip 'gz:' prefix
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const ds = new DecompressionStream(format)
  const writer = ds.writable.getWriter()
  await writer.write(binary)
  await writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  let totalLength = 0
  for (const chunk of chunks) totalLength += chunk.length
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(result))
}

export function decompressGzip(data: string): Promise<unknown> {
  return decompress(data, 'gzip')
}

export function decompressZlib(data: string): Promise<unknown> {
  return decompress(data, 'deflate')
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/http/decompress.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add decompressGzip and decompressZlib utilities"
```

---

## Task 9: HttpClient + auth strategies

**Files:**
- Create: `screeps-connectivity/src/http/auth/AuthStrategy.ts`
- Create: `screeps-connectivity/src/http/auth/TokenAuth.ts`
- Create: `screeps-connectivity/src/http/auth/PasswordAuth.ts`
- Create: `screeps-connectivity/src/http/HttpClient.ts`
- Test: `screeps-connectivity/tests/http/HttpClient.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/http/HttpClient.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../../src/http/HttpClient.js'
import { TokenAuth } from '../../src/http/auth/TokenAuth.js'

function mockResponse(body: unknown, opts: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...opts.headers },
    ...opts,
  })
}

describe('HttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches X-Token and X-Username headers after authenticate()', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'tok123' }) })
    await http.authenticate()
    await http.request('GET', '/api/version')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Token']).toBe('tok123')
    expect(headers['X-Username']).toBe('tok123')
  })

  it('sends GET params as query string', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('GET', '/api/game/time', { shard: 'shard0' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('shard=shard0')
  })

  it('sends POST body as JSON', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('POST', '/api/user/console', { expression: 'Game.time', shard: 'shard0' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ expression: 'Game.time', shard: 'shard0' })
  })

  it('updates token from x-token response header', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'refreshed' },
    }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'old' }) })
    http.token = 'old'
    await http.request('GET', '/api/version')
    expect(http.token).toBe('refreshed')
  })

  it('retries once on 401 after re-authenticating', async () => {
    let calls = 0
    fetchMock.mockImplementation(() => {
      calls++
      if (calls === 1) return Promise.resolve(new Response('Unauthorized', { status: 401 }))
      return Promise.resolve(mockResponse({ ok: 1 }))
    })
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'tok' }) })
    http.token = 'tok'
    await http.request('GET', '/api/version')
    expect(calls).toBe(2)
  })

  it('throws on non-401 error status', async () => {
    fetchMock.mockResolvedValue(new Response('Server Error', { status: 500 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await expect(http.request('GET', '/api/version')).rejects.toThrow('HTTP 500')
  })

  it('decompresses gz: data field', async () => {
    // We just verify the detection — actual decompression tested in decompress.test.ts
    // Here: non-gz response data passes through unchanged
    fetchMock.mockResolvedValue(mockResponse({ ok: 1, data: { result: 42 } }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const res = await http.request<{ ok: number; data: { result: number } }>('GET', '/api/test')
    expect(res.data.result).toBe(42)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/http/HttpClient.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create auth strategy files**

`screeps-connectivity/src/http/auth/AuthStrategy.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'

export interface AuthStrategy {
  authenticate(http: HttpClient): Promise<string>
}
```

`screeps-connectivity/src/http/auth/TokenAuth.ts`:
```ts
import type { AuthStrategy } from './AuthStrategy.js'
import type { HttpClient } from '../HttpClient.js'

export class TokenAuth implements AuthStrategy {
  private readonly token: string

  constructor(opts: { token: string }) {
    this.token = opts.token
  }

  async authenticate(_http: HttpClient): Promise<string> {
    return this.token
  }
}
```

`screeps-connectivity/src/http/auth/PasswordAuth.ts`:
```ts
import type { AuthStrategy } from './AuthStrategy.js'
import type { HttpClient } from '../HttpClient.js'

export class PasswordAuth implements AuthStrategy {
  private readonly email: string
  private readonly password: string

  constructor(opts: { email: string; password: string }) {
    this.email = opts.email
    this.password = opts.password
  }

  async authenticate(http: HttpClient): Promise<string> {
    const res = await http.auth.signin(this.email, this.password)
    return res.token
  }
}
```

- [ ] **Step 4: Create HttpClient.ts**

`screeps-connectivity/src/http/HttpClient.ts`:
```ts
import { decompressGzip } from './decompress.js'
import type { AuthStrategy } from './auth/AuthStrategy.js'
import { createAuthEndpoints, type AuthEndpoints } from './endpoints/auth.js'
import { createGameEndpoints, type GameEndpoints } from './endpoints/game.js'
import { createUserEndpoints, type UserEndpoints } from './endpoints/user.js'
import { createLeaderboardEndpoints, type LeaderboardEndpoints } from './endpoints/leaderboard.js'
import { createExperimentalEndpoints, type ExperimentalEndpoints } from './endpoints/experimental.js'

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export class HttpClient {
  readonly baseUrl: string
  private readonly authStrategy: AuthStrategy
  token: string | null = null
  private retrying = false
  readonly rateLimits = new Map<string, RateLimitInfo>()

  readonly auth: AuthEndpoints
  readonly game: GameEndpoints
  readonly user: UserEndpoints
  readonly leaderboard: LeaderboardEndpoints
  readonly experimental: ExperimentalEndpoints

  constructor(opts: { url: string; auth: AuthStrategy }) {
    this.baseUrl = opts.url.endsWith('/') ? opts.url : `${opts.url}/`
    this.authStrategy = opts.auth
    this.auth = createAuthEndpoints(this)
    this.game = createGameEndpoints(this)
    this.user = createUserEndpoints(this)
    this.leaderboard = createLeaderboardEndpoints(this)
    this.experimental = createExperimentalEndpoints(this)
  }

  async authenticate(): Promise<void> {
    this.token = await this.authStrategy.authenticate(this)
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.baseUrl)
    const headers: Record<string, string> = {}

    if (this.token) {
      headers['X-Token'] = this.token
      headers['X-Username'] = this.token
    }

    const init: RequestInit = { method, headers }

    if (method === 'GET' && body) {
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }
    } else if (body) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const res = await fetch(url.toString(), init)

    const newToken = res.headers.get('x-token')
    if (newToken) this.token = newToken

    this.updateRateLimit(path, res)

    if (res.status === 401 && !this.retrying) {
      this.retrying = true
      try {
        await this.authenticate()
      } finally {
        this.retrying = false
      }
      return this.request<T>(method, path, body)
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    }

    const data = await res.json() as Record<string, unknown>

    if (typeof data['data'] === 'string' && (data['data'] as string).startsWith('gz:')) {
      data['data'] = await decompressGzip(data['data'] as string)
    }

    return data as T
  }

  private updateRateLimit(path: string, res: Response): void {
    const limit = res.headers.get('x-ratelimit-limit')
    const remaining = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    if (limit && remaining && reset) {
      this.rateLimits.set(path, {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      })
    }
  }
}
```

- [ ] **Step 5: Create stub endpoint files (needed for HttpClient to compile)**

Create these stubs — full implementation in Task 10.

`screeps-connectivity/src/http/endpoints/auth.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'
import type { ApiAuthSigninResponse, ApiAuthMeResponse, ApiAuthQueryTokenResponse } from '../../types/api.js'

export interface AuthEndpoints {
  signin(email: string, password: string): Promise<ApiAuthSigninResponse>
  me(): Promise<ApiAuthMeResponse>
  queryToken(token: string): Promise<ApiAuthQueryTokenResponse>
}

export function createAuthEndpoints(http: HttpClient): AuthEndpoints {
  return {
    signin: (email, password) => http.request('POST', '/api/auth/signin', { email, password }),
    me: () => http.request('GET', '/api/auth/me'),
    queryToken: (token) => http.request('GET', '/api/auth/query-token', { token }),
  }
}
```

`screeps-connectivity/src/http/endpoints/game.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'
import type { ApiRoomTerrainResponse, ApiRoomObjectsResponse, ApiVersionResponse, ApiShardsInfoResponse } from '../../types/api.js'

const DEFAULT_SHARD = 'shard0'

export interface GameEndpoints {
  roomTerrain(room: string, shard?: string): Promise<ApiRoomTerrainResponse>
  roomObjects(room: string, shard?: string): Promise<ApiRoomObjectsResponse>
  roomStatus(room: string, shard?: string): Promise<{ ok: number; status: string; novice?: string }>
  roomOverview(room: string, interval?: number, shard?: string): Promise<unknown>
  time(shard?: string): Promise<{ ok: number; time: number }>
  worldSize(shard?: string): Promise<unknown>
  mapStats(rooms: string[], statName: string, shard?: string): Promise<unknown>
  market: {
    ordersIndex(shard?: string): Promise<unknown>
    myOrders(): Promise<unknown>
    orders(resourceType: string, shard?: string): Promise<unknown>
    stats(resourceType: string, shard?: string): Promise<unknown>
  }
  shards: {
    info(): Promise<ApiShardsInfoResponse>
  }
}

export function createGameEndpoints(http: HttpClient): GameEndpoints {
  return {
    roomTerrain: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-terrain', { room, encoded: 1, shard }),
    roomObjects: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-objects', { room, shard }),
    roomStatus: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-status', { room, shard }),
    roomOverview: (room, interval = 8, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-overview', { room, interval, shard }),
    time: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/time', { shard }),
    worldSize: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/world-size', { shard }),
    mapStats: (rooms, statName, shard = DEFAULT_SHARD) => http.request('POST', '/api/game/map-stats', { rooms, statName, shard }),
    market: {
      ordersIndex: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/orders-index', { shard }),
      myOrders: () => http.request('GET', '/api/game/market/my-orders'),
      orders: (resourceType, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/orders', { resourceType, shard }),
      stats: (resourceType, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/stats', { resourceType, shard }),
    },
    shards: {
      info: () => http.request('GET', '/api/game/shards/info'),
    },
  }
}
```

`screeps-connectivity/src/http/endpoints/user.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'
import type { ApiUserBranchesResponse } from '../../types/api.js'

const DEFAULT_SHARD = 'shard0'

export interface UserEndpoints {
  branches(): Promise<ApiUserBranchesResponse>
  code: {
    get(branch: string): Promise<unknown>
    set(branch: string, modules: Record<string, string>): Promise<unknown>
  }
  memory: {
    get(path: string, shard?: string): Promise<{ ok: number; data: unknown }>
    set(path: string, value: unknown, shard?: string): Promise<unknown>
    segment: {
      get(segment: number, shard?: string): Promise<{ ok: number; data: string }>
      set(segment: number, data: string, shard?: string): Promise<unknown>
    }
  }
  console(expression: string, shard?: string): Promise<unknown>
  stats(interval: number): Promise<unknown>
  rooms(id: string): Promise<unknown>
  overview(interval: number, statName: string): Promise<unknown>
  worldStatus(): Promise<{ ok: number; status: 'normal' | 'lost' | 'empty' }>
  worldStartRoom(shard?: string): Promise<unknown>
}

export function createUserEndpoints(http: HttpClient): UserEndpoints {
  return {
    branches: () => http.request('GET', '/api/user/branches'),
    code: {
      get: (branch) => http.request('GET', '/api/user/code', { branch }),
      set: (branch, modules) => http.request('POST', '/api/user/code', { branch, modules, _hash: Date.now() }),
    },
    memory: {
      get: (path, shard = DEFAULT_SHARD) => http.request('GET', '/api/user/memory', { path, shard }),
      set: (path, value, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/memory', { path, value, shard }),
      segment: {
        get: (segment, shard = DEFAULT_SHARD) => http.request('GET', '/api/user/memory-segment', { segment, shard }),
        set: (segment, data, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/memory-segment', { segment, data, shard }),
      },
    },
    console: (expression, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/console', { expression, shard }),
    stats: (interval) => http.request('GET', '/api/user/stats', { interval }),
    rooms: (id) => http.request('GET', '/api/user/rooms', { id }),
    overview: (interval, statName) => http.request('GET', '/api/user/overview', { interval, statName }),
    worldStatus: () => http.request('GET', '/api/user/world-status'),
    worldStartRoom: (shard = DEFAULT_SHARD) => http.request('GET', '/api/user/world-start-room', { shard }),
  }
}
```

`screeps-connectivity/src/http/endpoints/leaderboard.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'
import type { ApiLeaderboardListResponse, ApiLeaderboardSeasonsResponse } from '../../types/api.js'

export interface LeaderboardEndpoints {
  list(limit?: number, mode?: 'world' | 'power', offset?: number, season?: string): Promise<ApiLeaderboardListResponse>
  find(username: string, mode?: string, season?: string): Promise<unknown>
  seasons(): Promise<ApiLeaderboardSeasonsResponse>
}

export function createLeaderboardEndpoints(http: HttpClient): LeaderboardEndpoints {
  return {
    list: (limit = 10, mode = 'world', offset = 0, season) => http.request('GET', '/api/leaderboard/list', { limit, mode, offset, season }),
    find: (username, mode = 'world', season = '') => http.request('GET', '/api/leaderboard/find', { username, mode, season }),
    seasons: () => http.request('GET', '/api/leaderboard/seasons'),
  }
}
```

`screeps-connectivity/src/http/endpoints/experimental.ts`:
```ts
import type { HttpClient } from '../HttpClient.js'

export interface ExperimentalEndpoints {
  pvp(interval?: number): Promise<unknown>
  nukes(): Promise<unknown>
}

export function createExperimentalEndpoints(http: HttpClient): ExperimentalEndpoints {
  return {
    pvp: (interval = 100) => http.request('GET', '/api/experimental/pvp', { interval }),
    nukes: () => http.request('GET', '/api/experimental/nukes'),
  }
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/http/HttpClient.test.ts
```

Expected: 7 passing.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd screeps-connectivity && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add HttpClient, auth strategies, and all HTTP endpoints"
```

---

## Task 10: SocketClient — MessageParser

**Files:**
- Create: `screeps-connectivity/src/socket/MessageParser.ts`
- Test: `screeps-connectivity/tests/socket/MessageParser.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/socket/MessageParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseMessage } from '../../src/socket/MessageParser.js'

describe('parseMessage', () => {
  it('parses auth ok with token', async () => {
    expect(await parseMessage('auth ok abc123')).toEqual({
      kind: 'server',
      command: { type: 'auth', status: 'ok', token: 'abc123' },
    })
  })

  it('parses auth failed', async () => {
    expect(await parseMessage('auth failed')).toEqual({
      kind: 'server',
      command: { type: 'auth', status: 'failed', token: undefined },
    })
  })

  it('parses time command', async () => {
    expect(await parseMessage('time 99999')).toEqual({
      kind: 'server',
      command: { type: 'time', time: 99999 },
    })
  })

  it('parses protocol command', async () => {
    expect(await parseMessage('protocol 13')).toEqual({
      kind: 'server',
      command: { type: 'protocol', protocol: 13 },
    })
  })

  it('parses package command', async () => {
    expect(await parseMessage('package 42')).toEqual({
      kind: 'server',
      command: { type: 'package', package: 42 },
    })
  })

  it('parses JSON array channel message', async () => {
    const raw = JSON.stringify(['user:uid123/cpu', { cpu: 30, memory: 1024 }])
    expect(await parseMessage(raw)).toEqual({
      kind: 'channel',
      message: { channel: 'user:uid123/cpu', data: { cpu: 30, memory: 1024 } },
    })
  })

  it('accepts MessageEvent (browser WS format)', async () => {
    const event = { data: 'time 500' } as MessageEvent
    expect(await parseMessage(event)).toEqual({
      kind: 'server',
      command: { type: 'time', time: 500 },
    })
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/socket/MessageParser.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement MessageParser.ts**

`screeps-connectivity/src/socket/MessageParser.ts`:
```ts
import { decompressZlib } from '../http/decompress.js'

export type ServerCommand =
  | { type: 'auth'; status: 'ok' | 'failed'; token: string | undefined }
  | { type: 'time'; time: number }
  | { type: 'protocol'; protocol: number }
  | { type: 'package'; package: number }

export interface ChannelMessage {
  channel: string
  data: unknown
}

export type ParsedMessage =
  | { kind: 'server'; command: ServerCommand }
  | { kind: 'channel'; message: ChannelMessage }

export async function parseMessage(raw: string | MessageEvent): Promise<ParsedMessage> {
  let msg = typeof raw === 'string' ? raw : (raw.data as string)

  if (msg.startsWith('gz:')) {
    msg = JSON.stringify(await decompressZlib(msg))
  }

  if (msg.startsWith('[')) {
    const [channel, data] = JSON.parse(msg) as [string, unknown]
    return { kind: 'channel', message: { channel, data } }
  }

  const [cmd, ...rest] = msg.split(' ')

  switch (cmd) {
    case 'auth':
      return { kind: 'server', command: { type: 'auth', status: rest[0] as 'ok' | 'failed', token: rest[1] } }
    case 'time':
      return { kind: 'server', command: { type: 'time', time: parseInt(rest[0], 10) } }
    case 'protocol':
      return { kind: 'server', command: { type: 'protocol', protocol: parseInt(rest[0], 10) } }
    case 'package':
      return { kind: 'server', command: { type: 'package', package: parseInt(rest[0], 10) } }
    default:
      throw new Error(`Unknown server command: ${cmd}`)
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/socket/MessageParser.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add SocketClient MessageParser"
```

---

## Task 11: SocketClient

**Files:**
- Create: `screeps-connectivity/src/socket/SocketClient.ts`
- Test: `screeps-connectivity/tests/socket/SocketClient.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/socket/SocketClient.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SocketClient } from '../../src/socket/SocketClient.js'

class MockWS {
  static instances: MockWS[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    MockWS.instances.push(this)
  }

  send(data: string) { this.sent.push(data) }
  close() { this.onclose?.() }

  simulateOpen() { this.onopen?.() }
  simulateMessage(data: string) { this.onmessage?.({ data } as MessageEvent) }
  simulateClose() { this.onclose?.() }
}

beforeEach(() => { MockWS.instances = [] })

function makeClient() {
  return new SocketClient({ url: 'http://test.local', WebSocket: MockWS as unknown as typeof WebSocket })
}

async function connectClient(client: SocketClient, token = 'tok') {
  const connectPromise = client.connect(token)
  const ws = MockWS.instances[0]
  ws.simulateOpen()
  ws.simulateMessage('auth ok newtoken')
  await connectPromise
  return ws
}

describe('SocketClient', () => {
  it('connects to the correct WebSocket URL', async () => {
    const client = makeClient()
    const promise = client.connect('tok')
    const ws = MockWS.instances[0]
    expect(ws.url).toBe('ws://test.local/socket/websocket')
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await promise
  })

  it('sends auth token on open', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    expect(ws.sent).toContain('auth tok')
  })

  it('resolves connect() after auth ok', async () => {
    const client = makeClient()
    await expect(connectClient(client)).resolves.toBeDefined()
  })

  it('subscribe sends subscribe message when authed', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    ws.sent.length = 0
    client.subscribe('room:shard0/W7N7')
    expect(ws.sent).toContain('subscribe room:shard0/W7N7')
  })

  it('subscribe refcounts — subscribe message sent only once for multiple subs', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    ws.sent.length = 0
    client.subscribe('room:shard0/W7N7')
    client.subscribe('room:shard0/W7N7')
    const subscribeMsgs = ws.sent.filter(s => s.startsWith('subscribe'))
    expect(subscribeMsgs).toHaveLength(1)
  })

  it('unsubscribe sent when last subscriber disposes', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const sub1 = client.subscribe('room:shard0/W7N7')
    const sub2 = client.subscribe('room:shard0/W7N7')
    ws.sent.length = 0
    sub1.dispose()
    expect(ws.sent.filter(s => s.startsWith('unsubscribe'))).toHaveLength(0)
    sub2.dispose()
    expect(ws.sent).toContain('unsubscribe room:shard0/W7N7')
  })

  it('on() delivers channel messages to listener', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const handler = vi.fn()
    client.on('user:uid/cpu', handler)
    ws.simulateMessage(JSON.stringify(['user:uid/cpu', { cpu: 25 }]))
    await new Promise(r => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith({ cpu: 25 })
  })

  it('on() subscription dispose removes listener', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const handler = vi.fn()
    const sub = client.on('user:uid/cpu', handler)
    sub.dispose()
    ws.simulateMessage(JSON.stringify(['user:uid/cpu', { cpu: 25 }]))
    await new Promise(r => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
  })

  it('isConnected reflects state', async () => {
    const client = makeClient()
    expect(client.isConnected).toBe(false)
    await connectClient(client)
    expect(client.isConnected).toBe(true)
    client.disconnect()
    expect(client.isConnected).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/socket/SocketClient.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement SocketClient.ts**

`screeps-connectivity/src/socket/SocketClient.ts`:
```ts
import { parseMessage } from './MessageParser.js'
import type { Subscription } from '../subscription/index.js'

type WsConstructor = typeof globalThis.WebSocket

export class SocketClient {
  private readonly wsUrl: string
  private readonly WS: WsConstructor
  private ws: WebSocket | null = null
  private token: string | null = null
  private authed = false
  private _connected = false
  private reconnecting = false
  private readonly queue: string[] = []
  private readonly subs = new Map<string, number>()
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>()

  private readonly MAX_RETRIES = 10
  private readonly MAX_DELAY_MS = 60_000

  constructor(opts: { url: string; WebSocket?: WsConstructor }) {
    const base = opts.url.replace(/^http/, 'ws').replace(/\/$/, '')
    this.wsUrl = `${base}/socket/websocket`
    this.WS = opts.WebSocket ?? globalThis.WebSocket
  }

  get isConnected(): boolean {
    return this._connected
  }

  connect(token: string): Promise<void> {
    this.token = token
    return new Promise((resolve, reject) => {
      this.ws = new this.WS(this.wsUrl) as WebSocket
      this.ws.onopen = () => {
        this._connected = true
        this.reconnecting = false
        this.rawSend(`auth ${this.token}`)
        this.once('auth', (data) => {
          const cmd = data as { status: string; token?: string }
          if (cmd.status === 'ok') {
            this.authed = true
            if (cmd.token) this.token = cmd.token
            while (this.queue.length) this.rawSend(this.queue.shift()!)
            this.emit('connected', {})
            resolve()
          } else {
            reject(new Error('WebSocket auth failed'))
          }
        })
      }
      this.ws.onclose = () => {
        this._connected = false
        this.authed = false
        this.emit('disconnected', { willReconnect: this.reconnecting || true })
        void this.scheduleReconnect()
      }
      this.ws.onerror = (err) => {
        if (!this._connected) reject(err)
      }
      this.ws.onmessage = (event) => void this.handleMessage(event)
    })
  }

  disconnect(): void {
    this.reconnecting = false
    this.ws?.close()
    this.ws = null
    this._connected = false
    this.authed = false
    this.queue.length = 0
  }

  subscribe(channel: string): Subscription {
    const count = this.subs.get(channel) ?? 0
    this.subs.set(channel, count + 1)
    if (count === 0) {
      this.sendOrQueue(`subscribe ${channel}`)
    }
    return { dispose: () => this.doUnsubscribe(channel) }
  }

  on(channel: string, cb: (data: unknown) => void): Subscription {
    let set = this.listeners.get(channel)
    if (!set) { set = new Set(); this.listeners.set(channel, set) }
    set.add(cb)
    return { dispose: () => { this.listeners.get(channel)?.delete(cb) } }
  }

  private once(channel: string, cb: (data: unknown) => void): void {
    const sub = this.on(channel, (data) => { sub.dispose(); cb(data) })
  }

  private doUnsubscribe(channel: string): void {
    const count = this.subs.get(channel) ?? 0
    if (count <= 1) {
      this.subs.delete(channel)
      if (this.authed) this.rawSend(`unsubscribe ${channel}`)
    } else {
      this.subs.set(channel, count - 1)
    }
  }

  private rawSend(data: string): void {
    this.ws?.send(data)
  }

  private sendOrQueue(data: string): void {
    if (this.authed) this.rawSend(data)
    else this.queue.push(data)
  }

  private emit(channel: string, data: unknown): void {
    this.listeners.get(channel)?.forEach(cb => cb(data))
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const parsed = await parseMessage(event)
    if (parsed.kind === 'server') {
      this.emit(parsed.command.type, parsed.command)
    } else {
      this.emit(parsed.message.channel, parsed.message.data)
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting) return
    this.reconnecting = true
    let retries = 0
    while (retries < this.MAX_RETRIES && this.reconnecting) {
      const delay = Math.min(Math.pow(2, retries) * 100, this.MAX_DELAY_MS)
      await new Promise(r => setTimeout(r, delay))
      if (!this.reconnecting) return
      try {
        await this.connect(this.token!)
        for (const channel of this.subs.keys()) {
          this.rawSend(`subscribe ${channel}`)
        }
        return
      } catch {
        retries++
      }
    }
    this.reconnecting = false
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/socket/SocketClient.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd screeps-connectivity && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add SocketClient with reconnect and subscription tracking"
```

---

## Task 12: TypedStore base class

**Files:**
- Create: `screeps-connectivity/src/stores/TypedStore.ts`
- Test: `screeps-connectivity/tests/stores/TypedStore.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/stores/TypedStore.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/stores/TypedStore.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement TypedStore.ts**

`screeps-connectivity/src/stores/TypedStore.ts`:
```ts
import type { Subscription } from '../subscription/index.js'

export class TypedStore<EventMap extends Record<string, unknown>> extends EventTarget {
  emit<K extends string & keyof EventMap>(type: K, detail: EventMap[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  on<K extends string & keyof EventMap>(
    type: K,
    handler: (detail: EventMap[K]) => void,
  ): Subscription {
    const listener = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail)
    this.addEventListener(type, listener)
    return { dispose: () => this.removeEventListener(type, listener) }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/stores/TypedStore.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add TypedStore base class"
```

---

## Task 13: RoomStore

**Files:**
- Create: `screeps-connectivity/src/stores/RoomStore.ts`
- Test: `screeps-connectivity/tests/stores/RoomStore.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/stores/RoomStore.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoomStore } from '../../src/stores/RoomStore.js'
import { Cache } from '../../src/cache/Cache.js'
import { TerrainType } from '../../src/types/game.js'

function makeStore() {
  const http = {
    game: {
      roomTerrain: vi.fn().mockResolvedValue({
        ok: 1,
        terrain: [{ _id: 'id', room: 'W7N7', terrain: '0'.repeat(2500), type: 'terrain' }],
      }),
    },
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    subscribe: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  const cache = new Cache('test', null)
  const store = new RoomStore(http, socket, cache)
  return { store, http, socket, cache }
}

describe('RoomStore', () => {
  it('fetches terrain from API on first call', async () => {
    const { store, http } = makeStore()
    const terrain = await store.terrain('W7N7', 'shard0')
    expect(http.game.roomTerrain).toHaveBeenCalledWith('W7N7', 'shard0')
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
  })

  it('returns cached terrain on second call', async () => {
    const { store, http } = makeStore()
    await store.terrain('W7N7', 'shard0')
    await store.terrain('W7N7', 'shard0')
    expect(http.game.roomTerrain).toHaveBeenCalledOnce()
  })

  it('objects() returns null before any subscription updates', () => {
    const { store } = makeStore()
    expect(store.objects('W7N7', 'shard0')).toBeNull()
  })

  it('subscribe() calls socket.subscribe with the correct channel', () => {
    const { store, socket } = makeStore()
    store.subscribe('W7N7', 'shard0')
    expect(socket.subscribe).toHaveBeenCalledWith('room:shard0/W7N7')
  })

  it('subscribe() returns a Subscription with dispose()', () => {
    const { store } = makeStore()
    const sub = store.subscribe('W7N7', 'shard0')
    expect(typeof sub.dispose).toBe('function')
  })

  it('merges room object diff on WS updates', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')

    // First message: full state
    messageHandler({
      objects: { id1: { _id: 'id1', type: 'creep', room: 'W7N7', x: 10, y: 10 } },
      gameTime: 1000,
    })

    expect(store.objects('W7N7', 'shard0')).toMatchObject({
      id1: { _id: 'id1', type: 'creep' },
    })

    // Second message: diff
    messageHandler({
      objects: { id1: { x: 11, y: 11 } },
      gameTime: 1001,
    })

    expect(store.objects('W7N7', 'shard0')?.['id1']).toMatchObject({ x: 11, y: 11, type: 'creep' })
  })

  it('emits room:update event on WS message', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    const handler = vi.fn()
    store.on('room:update', handler)
    store.subscribe('W7N7', 'shard0')
    messageHandler({ objects: {}, gameTime: 2000 })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ room: 'W7N7', shard: 'shard0', gameTime: 2000 }))
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/stores/RoomStore.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement RoomStore.ts**

`screeps-connectivity/src/stores/RoomStore.ts`:
```ts
import { TypedStore } from './TypedStore.js'
import { RoomTerrain } from '../types/game.js'
import type { RoomStoreEvents } from '../types/events.js'
import type { RoomObject, RoomObjectMap } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'
import type { Subscription } from '../subscription/index.js'

export class RoomStore extends TypedStore<RoomStoreEvents> {
  private readonly http: HttpClient
  private readonly socket: SocketClient
  private readonly cache: Cache
  private readonly roomObjects = new Map<string, RoomObjectMap>()

  constructor(http: HttpClient, socket: SocketClient, cache: Cache) {
    super()
    this.http = http
    this.socket = socket
    this.cache = cache
  }

  async terrain(room: string, shard: string): Promise<RoomTerrain> {
    const key = `terrain/${shard}/${room}`

    const cached = this.cache.get<RoomTerrain>(key)
    if (cached) return cached

    const persisted = await this.cache.getPersistent(key)
    if (persisted) {
      const terrain = new RoomTerrain(persisted)
      this.cache.set(key, terrain)
      return terrain
    }

    const res = await this.http.game.roomTerrain(room, shard)
    const terrain = RoomTerrain.fromEncodedString(res.terrain[0].terrain)

    this.cache.set(key, terrain)
    await this.cache.setPersistent(key, terrain.raw)
    this.emit('room:terrainavailable', { room, shard, terrain })

    return terrain
  }

  objects(room: string, shard: string): RoomObjectMap | null {
    return this.roomObjects.get(`${room}/${shard}`) ?? null
  }

  subscribe(room: string, shard: string): Subscription {
    const channel = `room:${shard}/${room}`
    const socketSub = this.socket.subscribe(channel)

    const listenerSub = this.socket.on(channel, (data) => {
      const update = data as { objects: Record<string, Partial<RoomObject> | null>; gameTime: number }
      const mapKey = `${room}/${shard}`
      const current: RoomObjectMap = { ...(this.roomObjects.get(mapKey) ?? {}) }

      for (const [id, obj] of Object.entries(update.objects)) {
        if (obj === null) {
          delete current[id]
        } else if (current[id]) {
          current[id] = { ...current[id], ...obj } as RoomObject
        } else {
          current[id] = obj as RoomObject
        }
      }

      this.roomObjects.set(mapKey, current)
      this.emit('room:update', { room, shard, gameTime: update.gameTime, objects: current })
    })

    return {
      dispose: () => {
        socketSub.dispose()
        listenerSub.dispose()
        this.roomObjects.delete(`${room}/${shard}`)
      },
    }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/stores/RoomStore.test.ts
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add RoomStore with terrain cache and diff merging"
```

---

## Task 14: UserStore + ServerStore

**Files:**
- Create: `screeps-connectivity/src/stores/UserStore.ts`
- Create: `screeps-connectivity/src/stores/ServerStore.ts`
- Test: `screeps-connectivity/tests/stores/UserStore.test.ts`
- Test: `screeps-connectivity/tests/stores/ServerStore.test.ts`

- [ ] **Step 1: Write failing UserStore tests**

`screeps-connectivity/tests/stores/UserStore.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { UserStore } from '../../src/stores/UserStore.js'
import { Cache } from '../../src/cache/Cache.js'
import type { UserInfo } from '../../src/types/game.js'

const mockUser: UserInfo = { _id: 'uid1', username: 'user', email: 'a@b.com', cpu: 20, gcl: 100, credits: 50, badge: { type: 1, color1: '#fff', color2: '#000', color3: '#f00', param: 0, flip: false } }

function makeStore() {
  const http = {
    auth: { me: vi.fn().mockResolvedValue({ ...mockUser, ok: 1 }) },
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    subscribe: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  const cache = new Cache('test', null)
  return { store: new UserStore(http, socket, cache), http, socket }
}

describe('UserStore', () => {
  it('fetches user info from API', async () => {
    const { store } = makeStore()
    const user = await store.me()
    expect(user.username).toBe('user')
  })

  it('caches user info after first fetch', async () => {
    const { store, http } = makeStore()
    await store.me()
    await store.me()
    expect(http.auth.me).toHaveBeenCalledOnce()
  })

  it('subscribe cpu starts WS subscription with userId prefix', async () => {
    const { store, socket } = makeStore()
    await store.me() // preload user id
    store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0)) // let async userId lookup settle
    expect(socket.subscribe).toHaveBeenCalledWith('user:uid1/cpu')
  })

  it('cpu stats are updated via WS and event fired', async () => {
    const { store, socket } = makeStore()
    await store.me()
    let handler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      handler = cb
      return { dispose: vi.fn() }
    })
    const eventSpy = vi.fn()
    store.on('user:cpu', eventSpy)
    store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0))
    handler({ cpu: 42, memory: 1024 })
    expect(store.cpu).toEqual({ cpu: 42, memory: 1024 })
    expect(eventSpy).toHaveBeenCalledWith({ cpu: 42, memory: 1024 })
  })

  it('console messages accumulate and emit event', async () => {
    const { store, socket } = makeStore()
    await store.me()
    let handler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      handler = cb
      return { dispose: vi.fn() }
    })
    store.subscribe('console')
    await new Promise(r => setTimeout(r, 0))
    handler({ log: ['line1'], results: [] })
    expect(store.console).toHaveLength(1)
  })

  it('dispose() stops WS subscription', async () => {
    const { store, socket } = makeStore()
    await store.me()
    const mockDispose = vi.fn()
    ;(socket.subscribe as ReturnType<typeof vi.fn>).mockReturnValue({ dispose: mockDispose })
    const sub = store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0))
    sub.dispose()
    expect(mockDispose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write failing ServerStore tests**

`screeps-connectivity/tests/stores/ServerStore.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { ServerStore } from '../../src/stores/ServerStore.js'
import { Cache } from '../../src/cache/Cache.js'
import type { ApiVersionResponse } from '../../src/types/api.js'

const mockVersion: ApiVersionResponse = { ok: 1, package: 5, protocol: 13, users: 100, serverData: { historyChunkSize: 20, features: [], shards: ['shard0'] } }

function makeStore() {
  const http = {
    request: vi.fn().mockResolvedValue({ ...mockVersion }),
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  return { store: new ServerStore(http, socket, new Cache('test', null)), http, socket }
}

describe('ServerStore', () => {
  it('fetches server version', async () => {
    const { store } = makeStore()
    const v = await store.version()
    expect(v.protocol).toBe(13)
  })

  it('caches version after first fetch', async () => {
    const { store, http } = makeStore()
    await store.version()
    await store.version()
    expect(http.request).toHaveBeenCalledOnce()
  })

  it('emits server:connected when socket fires connected event', () => {
    const { store, socket } = makeStore()
    let connectedCb: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((ch: string, cb: (data: unknown) => void) => {
      if (ch === 'connected') connectedCb = cb
      return { dispose: vi.fn() }
    })
    // Re-create store to trigger the socket.on wiring
    const store2 = new ServerStore(socket as unknown as import('../../src/http/HttpClient.js').HttpClient, socket, new Cache('t', null))
    const spy = vi.fn()
    store2.on('server:connected', spy)
    connectedCb({})
    expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/stores/UserStore.test.ts tests/stores/ServerStore.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 4: Implement UserStore.ts**

`screeps-connectivity/src/stores/UserStore.ts`:
```ts
import { TypedStore } from './TypedStore.js'
import type { UserStoreEvents } from '../types/events.js'
import type { UserInfo, CpuStats, ConsoleMessage } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'
import type { Subscription } from '../subscription/index.js'

export class UserStore extends TypedStore<UserStoreEvents> {
  private readonly http: HttpClient
  private readonly socket: SocketClient
  private readonly cache: Cache
  readonly console: ConsoleMessage[] = []
  readonly maxConsoleSize: number
  cpu: CpuStats | null = null
  private userId: string | null = null

  constructor(http: HttpClient, socket: SocketClient, cache: Cache, maxConsoleSize = 100) {
    super()
    this.http = http
    this.socket = socket
    this.cache = cache
    this.maxConsoleSize = maxConsoleSize
  }

  async me(): Promise<UserInfo> {
    const cached = this.cache.get<UserInfo>('user/me')
    if (cached) return cached
    const res = await this.http.auth.me()
    const user = res as unknown as UserInfo
    this.userId = user._id
    this.cache.set('user/me', user, 60_000)
    return user
  }

  subscribe(channel: 'console' | 'cpu' | 'code'): Subscription {
    let socketSub: Subscription | null = null
    let listenerSub: Subscription | null = null
    let disposed = false

    const setup = async () => {
      const uid = this.userId ?? (await this.me())._id
      if (disposed) return
      const fullChannel = `user:${uid}/${channel}`
      socketSub = this.socket.subscribe(fullChannel)
      listenerSub = this.socket.on(fullChannel, (data) => {
        if (channel === 'cpu') {
          this.cpu = data as CpuStats
          this.emit('user:cpu', this.cpu)
        } else if (channel === 'console') {
          const msg = data as ConsoleMessage
          this.console.push(msg)
          if (this.console.length > this.maxConsoleSize) {
            this.console.splice(0, this.console.length - this.maxConsoleSize)
          }
          this.emit('user:console', { messages: msg })
        } else if (channel === 'code') {
          this.emit('user:code', data as { branch: string; modules: Record<string, string> })
        }
      })
    }

    void setup()

    return {
      dispose: () => {
        disposed = true
        socketSub?.dispose()
        listenerSub?.dispose()
      },
    }
  }
}
```

- [ ] **Step 5: Implement ServerStore.ts**

`screeps-connectivity/src/stores/ServerStore.ts`:
```ts
import { TypedStore } from './TypedStore.js'
import type { ServerStoreEvents } from '../types/events.js'
import type { ServerVersion, ShardInfo } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'

export class ServerStore extends TypedStore<ServerStoreEvents> {
  private readonly http: HttpClient
  private readonly cache: Cache

  constructor(http: HttpClient, socket: SocketClient, cache: Cache) {
    super()
    this.http = http
    this.cache = cache

    socket.on('connected', () => {
      this.emit('server:connected', {})
    })
    socket.on('disconnected', (data) => {
      const d = data as { willReconnect: boolean }
      this.emit('server:disconnected', { willReconnect: d.willReconnect })
    })
  }

  async version(): Promise<ServerVersion> {
    const cached = this.cache.get<ServerVersion>('server/version')
    if (cached) return cached
    const res = await this.http.request<ServerVersion>('GET', '/api/version')
    this.cache.set('server/version', res, 5 * 60_000)
    return res
  }

  async shards(): Promise<ShardInfo[]> {
    const res = await this.http.request<{ ok: number; shards: ShardInfo[] }>('GET', '/api/game/shards/info')
    return res.shards
  }
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd screeps-connectivity && npx vitest run tests/stores/UserStore.test.ts tests/stores/ServerStore.test.ts
```

Expected: 9 passing (6 UserStore + 3 ServerStore).

- [ ] **Step 7: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add UserStore and ServerStore"
```

---

## Task 15: ScreepsClient facade + public exports

**Files:**
- Create: `screeps-connectivity/src/ScreepsClient.ts`
- Modify: `screeps-connectivity/src/index.ts`
- Test: `screeps-connectivity/tests/ScreepsClient.test.ts`

- [ ] **Step 1: Write failing tests**

`screeps-connectivity/tests/ScreepsClient.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScreepsClient } from '../src/ScreepsClient.js'
import { TokenAuth } from '../src/http/auth/TokenAuth.js'

class MockWS {
  static instances: MockWS[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  sent: string[] = []
  constructor() { MockWS.instances.push(this) }
  send(d: string) { this.sent.push(d) }
  close() {}
  simulateOpen() { this.onopen?.() }
  simulateMessage(d: string) { this.onmessage?.({ data: d } as MessageEvent) }
}

beforeEach(() => {
  MockWS.instances = []
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: 1, token: 'authed' }), {
      headers: { 'content-type': 'application/json' },
    })
  ))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ScreepsClient', () => {
  it('exposes http, socket, and stores properties', () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    expect(client.http).toBeDefined()
    expect(client.socket).toBeDefined()
    expect(client.stores.room).toBeDefined()
    expect(client.stores.user).toBeDefined()
    expect(client.stores.server).toBeDefined()
  })

  it('connect() authenticates then opens WebSocket', async () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    const connectPromise = client.connect()
    await new Promise(r => setTimeout(r, 0))
    const ws = MockWS.instances[0]
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await connectPromise
    expect(client.isConnected).toBe(true)
  })

  it('isConnected is false before connect()', () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    expect(client.isConnected).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd screeps-connectivity && npx vitest run tests/ScreepsClient.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement ScreepsClient.ts**

`screeps-connectivity/src/ScreepsClient.ts`:
```ts
import { HttpClient } from './http/HttpClient.js'
import { SocketClient } from './socket/SocketClient.js'
import { Cache } from './cache/Cache.js'
import { RoomStore } from './stores/RoomStore.js'
import { UserStore } from './stores/UserStore.js'
import { ServerStore } from './stores/ServerStore.js'
import type { AuthStrategy } from './http/auth/AuthStrategy.js'
import type { StorageAdapter } from './storage/StorageAdapter.js'

type WsConstructor = typeof globalThis.WebSocket

export interface ScreepsClientOptions {
  url: string
  auth: AuthStrategy
  storage?: StorageAdapter | null
  WebSocket?: WsConstructor
}

export class ScreepsClient {
  readonly http: HttpClient
  readonly socket: SocketClient
  readonly stores: {
    readonly room: RoomStore
    readonly user: UserStore
    readonly server: ServerStore
  }
  private readonly cache: Cache

  constructor(opts: ScreepsClientOptions) {
    const namespace = new URL(opts.url).hostname
    this.cache = new Cache(namespace, opts.storage ?? null)
    this.http = new HttpClient({ url: opts.url, auth: opts.auth })
    this.socket = new SocketClient({ url: opts.url, WebSocket: opts.WebSocket })
    this.stores = {
      room: new RoomStore(this.http, this.socket, this.cache),
      user: new UserStore(this.http, this.socket, this.cache),
      server: new ServerStore(this.http, this.socket, this.cache),
    }
  }

  get isConnected(): boolean {
    return this.socket.isConnected
  }

  async connect(): Promise<void> {
    await this.http.authenticate()
    await this.socket.connect(this.http.token!)
  }

  disconnect(): void {
    this.socket.disconnect()
  }
}
```

- [ ] **Step 4: Write src/index.ts with all public exports**

`screeps-connectivity/src/index.ts`:
```ts
export { ScreepsClient } from './ScreepsClient.js'
export type { ScreepsClientOptions } from './ScreepsClient.js'

export { TokenAuth } from './http/auth/TokenAuth.js'
export { PasswordAuth } from './http/auth/PasswordAuth.js'
export type { AuthStrategy } from './http/auth/AuthStrategy.js'

export { IndexedDBStorage } from './storage/IndexedDBStorage.js'
export { FileStorage } from './storage/FileStorage.js'
export { NullStorage } from './storage/NullStorage.js'
export type { StorageAdapter } from './storage/StorageAdapter.js'

export { SubscriptionGroup } from './subscription/index.js'
export type { Subscription } from './subscription/index.js'

export { TerrainType, RoomTerrain } from './types/game.js'
export type {
  RoomObject,
  RoomObjectMap,
  UserInfo,
  CpuStats,
  ConsoleMessage,
  ServerVersion,
  ShardInfo,
  Badge,
} from './types/game.js'
export type { RoomStoreEvents, UserStoreEvents, ServerStoreEvents } from './types/events.js'
```

- [ ] **Step 5: Run all tests**

```bash
cd screeps-connectivity && npx vitest run
```

Expected: All tests passing across all test files.

- [ ] **Step 6: Build the library**

```bash
cd screeps-connectivity && npm run build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` created with no errors.

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd screeps-connectivity && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add screeps-connectivity/
git commit -m "feat: add ScreepsClient facade and public exports — library complete"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Native fetch, WebSocket, DecompressionStream | Tasks 8, 10, 11 |
| Token + PasswordAuth; SteamTicket extension point | Task 9 (AuthStrategy interface) |
| Two-tier cache, in-memory + persistent | Task 7 |
| Namespaced storage | Tasks 7, 15 (namespace = hostname) |
| Disable persistence at init (`storage: null`) | Task 15 |
| Inject WebSocket constructor | Tasks 11, 15 |
| IndexedDBStorage | Task 6 |
| FileStorage (URL namespace sanitized) | Task 5 |
| NullStorage | Task 4 |
| Terrain as Uint8Array, `get(x,y)`, `raw` | Task 2 |
| Subscription + SubscriptionGroup | Task 3 |
| TypedStore EventTarget base | Task 12 |
| RoomStore: terrain fetch+cache, diff merge | Task 13 |
| UserStore: me, cpu, console, code | Task 14 |
| ServerStore: version, shards, connected/disconnected events | Task 14 |
| ScreepsClient facade | Task 15 |
| Full public exports with types | Task 15 |
| tsup build (ESM + CJS + .d.ts) | Task 1 |
| Vitest tests | All tasks |
| Zero production dependencies | Task 1 |

All spec requirements are covered.
