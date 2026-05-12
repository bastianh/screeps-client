# screeps-connectivity — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  

---

## Overview

`screeps-connectivity` is an internal TypeScript library that provides HTTP connectivity, WebSocket management, two-tier caching, and typed reactive data stores for a new Screeps client application. It is designed to work without modification in browser, Tauri, and Node.js environments.

---

## Goals

- Connect to any Screeps server (official or private) via REST HTTP and WebSocket
- Provide typed, reactive data stores for room terrain, room objects, user state, and server info
- Cache persistent data (terrain) efficiently as binary, with optional storage that can be disabled
- Support multiple server connections via namespaced storage
- Zero production dependencies — all platform APIs are native
- Work in: modern browsers, Tauri (WebView), Node.js 22+, Node.js 18/20 (with injected WebSocket)

---

## Architecture

Five layers, each with a single responsibility:

```
┌─────────────────────────────────────────────────────┐
│                  ScreepsClient                       │
│         (facade, wires everything together)          │
├────────────────────┬────────────────────────────────┤
│    HttpClient      │       SocketClient              │
│  (fetch + auth +   │  (WebSocket + subscriptions +   │
│   rate limiting)   │   reconnect + message parsing)  │
├────────────────────┴────────────────────────────────┤
│                   DataStores                         │
│       RoomStore · UserStore · ServerStore            │
│       (extend EventTarget, emit typed events)        │
├─────────────────────────────────────────────────────┤
│                    Cache                             │
│     in-memory (Map) + optional StorageAdapter       │
├─────────────────────────────────────────────────────┤
│              StorageAdapter interface                │
│    IndexedDBStorage · FileStorage · NullStorage      │
└─────────────────────────────────────────────────────┘
```

---

## Platform Strategy

| Environment   | HTTP         | WebSocket        | Persistence adapter         |
|---------------|--------------|------------------|-----------------------------|
| Browser       | native fetch | native WS        | `IndexedDBStorage`          |
| Tauri         | native fetch | native WS        | `IndexedDBStorage`          |
| Node.js 22+   | native fetch | native WS        | `FileStorage`               |
| Node.js 18/20 | native fetch | injected `ws`    | `FileStorage`               |

Gzip decompression uses `DecompressionStream` (Node 18+ and all modern browsers). No `zlib`, no `axios`, no `ws` required in the core.

---

## Source Layout

```
src/
  index.ts                   — public exports
  ScreepsClient.ts           — main facade
  http/
    HttpClient.ts            — fetch wrapper, auth, rate limiting, decompression
    endpoints/
      auth.ts
      game.ts
      user.ts
      leaderboard.ts
      experimental.ts
  socket/
    SocketClient.ts          — WebSocket wrapper, reconnect, subscription tracking
    MessageParser.ts         — parses plain-text commands and JSON array messages
  stores/
    TypedStore.ts            — base class extending EventTarget
    RoomStore.ts
    UserStore.ts
    ServerStore.ts
  cache/
    Cache.ts                 — two-tier cache (memory + adapter)
    StorageAdapter.ts        — interface definition
  storage/
    IndexedDBStorage.ts
    FileStorage.ts
    NullStorage.ts
  types/
    game.ts                  — RoomObject, RoomObjectMap, TerrainType, etc.
    api.ts                   — REST response shapes
    events.ts                — typed CustomEvent detail types
```

---

## Layer Specifications

### ScreepsClient (facade)

Top-level entry point. Accepts configuration, instantiates and wires all layers.

```ts
new ScreepsClient({
  url: string,
  auth: AuthStrategy,
  storage?: StorageAdapter | null,   // null disables persistence
  WebSocket?: typeof WebSocket,      // inject for Node 18/20 or testing
})
```

Methods:
- `connect(): Promise<void>` — authenticates via `AuthStrategy`, opens WebSocket
- `disconnect(): Promise<void>` — graceful teardown
- `isConnected: boolean`

Exposes:
- `client.http` — `HttpClient` instance
- `client.socket` — `SocketClient` instance
- `client.stores.room` — `RoomStore`
- `client.stores.user` — `UserStore`
- `client.stores.server` — `ServerStore`

### HttpClient

Wraps `fetch`. All endpoints are typed async methods grouped by domain.

**Responsibilities:**
- Attaches `X-Token` / `X-Username` headers on every request
- On 401: retries once after re-authenticating via the `AuthStrategy`
- Tracks rate limits from `x-ratelimit-limit/remaining/reset` response headers
- Decompresses `gz:…` response bodies using `DecompressionStream`

**Endpoint groups:**
- `http.auth` — `signin`, `queryToken`, `me`
- `http.game` — `roomTerrain`, `roomObjects`, `roomStatus`, `roomOverview`, `time`, `worldSize`, `mapStats`, `market.*`, `shards.info`
- `http.user` — `me`, `code.*`, `memory.*`, `console`, `branches`, `stats`, `rooms`, `overview`
- `http.leaderboard` — `list`, `find`, `seasons`
- `http.experimental` — `pvp`, `nukes`

**Auth strategies:**
```ts
interface AuthStrategy {
  authenticate(http: HttpClient): Promise<string>  // returns token
}
class TokenAuth implements AuthStrategy      // accepts pre-obtained token
class PasswordAuth implements AuthStrategy   // calls /api/auth/signin
// future: class SteamTicketAuth implements AuthStrategy
```

`PasswordAuth` and `SteamTicketAuth` are the extension point for private-server Steam login support (private servers do not use tokens). Adding a new auth strategy requires no changes to `HttpClient`.

### SocketClient

Wraps native `WebSocket`. Accepts an optional injected constructor for Node 18/20 compat.

**Connection lifecycle:**
1. Open WS to `<serverUrl>/socket/websocket`
2. Send `auth <token>`, wait for `auth ok`
3. Drain queued messages and pending subscriptions
4. On disconnect: exponential backoff reconnect (`2^retries × 100ms`, cap 60s, max 10 retries)
5. On reconnect: re-subscribe all active channels

**Subscription tracking:**  
`Map<channel, refCount>` — same channel can be subscribed by multiple consumers. `unsubscribe` message is only sent to the server when `refCount` reaches zero.

**Message parsing (`SocketMessageParser`):**  
Two formats from the Screeps server:
- Plain-text commands: `"auth ok <token>"`, `"time 12345"`, `"protocol 13"`
- JSON array: `["user:abc123/console", { messages: { log: [], results: [] } }]`

Gzip: messages prefixed with `gz:` are decompressed via `DecompressionStream` before parsing.

### DataStores

Typed reactive stores that consume HTTP responses and WebSocket events, maintain current state, and notify consumers via typed events.

**Subscription handles:**

All subscribe and event-listener calls return a `Subscription` object so they can be composed and cleaned up together:

```ts
interface Subscription {
  dispose(): void
}

class SubscriptionGroup implements Subscription {
  add(sub: Subscription): void
  dispose(): void   // disposes all added subscriptions at once
}
```

This maps directly to framework lifecycle hooks:
```ts
// Svelte
onDestroy(() => group.dispose())

// SolidJS
onCleanup(() => group.dispose())
```

**Base class:**
```ts
class TypedStore<EventMap> extends EventTarget {
  emit<K extends keyof EventMap>(type: K, detail: EventMap[K]): void
  on<K extends keyof EventMap>(
    type: K,
    handler: (detail: EventMap[K]) => void
  ): Subscription   // dispose() removes the listener
}
```

**RoomStore:**

```ts
// Data access
terrain(room: string, shard: string): Promise<RoomTerrain>
objects(room: string, shard: string): RoomObjectMap | null
subscribe(room: string, shard: string): Subscription   // dispose() unsubscribes

// Events
type RoomStoreEvents = {
  'room:update': { room: string; shard: string; gameTime: number; objects: RoomObjectMap }
  'room:terrainavailable': { room: string; shard: string; terrain: RoomTerrain }
}
```

Room objects: on first WebSocket event, the server sends full state. Subsequent events are diffs. `RoomStore` merges diffs internally — consumers always see complete current state.

**UserStore:**

```ts
me(): Promise<UserInfo>
cpu: CpuStats | null
console: ConsoleMessage[]              // rolling buffer, configurable max size
subscribe(channel: 'console' | 'cpu' | 'code'): Subscription   // dispose() unsubscribes

type UserStoreEvents = {
  'user:cpu': { cpu: number; memory: number }
  'user:console': { messages: ConsoleMessage[] }
  'user:code': { branch: string; modules: Record<string, string> }
}
```

**ServerStore:**

```ts
version(): Promise<ServerVersion>
shards(): Promise<ShardInfo[]>

type ServerStoreEvents = {
  'server:connected': Record<string, never>
  'server:disconnected': { willReconnect: boolean }
  'server:error': { error: Error }
}
```

### Cache

Two-tier cache with in-memory primary and optional persistent secondary.

**Memory tier:** `Map<string, { data: unknown; expires?: number }>` — always active.  
**Persistent tier:** optional `StorageAdapter`. Skipped when `storage: null`.  
**Namespace:** derived from server URL at init — prevents collisions when connecting to multiple servers.

| Data type     | Memory | Persistent | TTL       |
|---------------|--------|------------|-----------|
| Room terrain  | ✓      | ✓          | permanent |
| Room objects  | ✓      | —          | per tick  |
| User info     | ✓      | —          | short     |
| Server version| ✓      | ✓          | long      |

### StorageAdapter

Binary interface — all data persisted as `Uint8Array`, no JSON or base64 overhead.

```ts
interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>
  set(key: string, data: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>   // clears all entries for this adapter's namespace
}
```

**`IndexedDBStorage(namespace)`** — browser and Tauri. Namespace is passed in by `ScreepsClient` (derived from server URL).  
**`FileStorage(baseDir: string, namespace)`** — Node.js. Stores each entry as a `.bin` file under `baseDir/<sanitized-namespace>/`. The namespace (server URL) is sanitized to a safe directory name.  
**`NullStorage`** — no-op adapter, equivalent to passing `storage: null`.

### Terrain Data Format

API response: 2500-character string of `'0'`–`'3'` (50×50 grid, left-to-right, top-to-bottom).

Stored in memory as `Uint8Array(2500)` — 1 byte per tile, values 0–3.  
Stored in persistence as raw binary blob — no encoding, minimal size.

```ts
enum TerrainType { Plain = 0, Wall = 1, Swamp = 2 }

class RoomTerrain {
  get(x: number, y: number): TerrainType
  raw: Uint8Array   // direct access for PixiJS rendering
}
```

---

## Public API

```ts
import {
  ScreepsClient,
  TokenAuth, PasswordAuth,
  IndexedDBStorage, FileStorage, NullStorage,
  SubscriptionGroup,
} from 'screeps-connectivity'

import type {
  StorageAdapter, AuthStrategy,
  Subscription,
  RoomTerrain, RoomObjectMap, RoomObject,
  UserInfo, CpuStats, ConsoleMessage,
  ServerVersion, ShardInfo,
  RoomStoreEvents, UserStoreEvents, ServerStoreEvents,
  TerrainType,
} from 'screeps-connectivity'
```

**Initialization:**
```ts
// Browser / Tauri
const client = new ScreepsClient({
  url: 'https://screeps.com',
  auth: new PasswordAuth({ email, password }),
  storage: new IndexedDBStorage(),
})

// Node.js
const client = new ScreepsClient({
  url: 'http://localhost:21025',
  auth: new TokenAuth({ token }),
  storage: new FileStorage('./cache'),
})

// No persistence
const client = new ScreepsClient({ url, auth, storage: null })

// Node 18/20
import WebSocket from 'ws'
const client = new ScreepsClient({ url, auth, storage, WebSocket })
```

**Usage:**
```ts
await client.connect()

// Fetch + cache terrain
const terrain = await client.stores.room.terrain('W7N7', 'shard0')
terrain.get(25, 25)  // TerrainType

// Real-time room subscription — group for clean teardown
const group = new SubscriptionGroup()
group.add(client.stores.room.subscribe('W7N7', 'shard0'))
group.add(client.stores.user.subscribe('console'))
group.add(client.stores.user.subscribe('cpu'))
group.add(client.stores.room.on('room:update', ({ gameTime, objects }) => {
  // update Svelte store / SolidJS signal / PixiJS stage
}))

// Svelte integration
onDestroy(() => group.dispose())

// SolidJS integration
onCleanup(() => group.dispose())

// PixiJS integration
group.add(client.stores.room.on('room:update', () => app.ticker.scheduleUpdate()))

// Direct HTTP
await client.http.user.console('Game.time', 'shard0')
```

---

## Build & Tooling

| Concern       | Tool                                     |
|---------------|------------------------------------------|
| Language      | TypeScript 5.x, `strict: true`           |
| Build         | `tsup` — ESM + CJS + `.d.ts` output      |
| Tests         | Vitest (ESM-native, browser mode for IDB)|
| Lint          | ESLint + `@typescript-eslint`            |
| Module format | `package.json` `exports` with `import` / `require` / `types` conditions |

**Production dependencies: zero.** All platform APIs are native. Dev dependencies only: TypeScript, tsup, Vitest, ESLint, `@typescript-eslint`.

---

## Out of Scope

- Steam auth (designed as an extension point, not implemented initially)
- Tauri-native file storage adapter (IndexedDB works fine in Tauri; native file adapter is a future addition)
- Publishing to npm (internal library)
- Full market/leaderboard helper logic beyond raw endpoint access
