---
title: connectivity
type: note
permalink: screeps-client/claude/connectivity
---

# screeps-connectivity — Architecture

Package: `screeps-connectivity/` · zero production dependencies · ESM + CJS via tsup

## Layer overview

```
ScreepsClient          — facade, wires everything together
  ├─ HttpClient        — fetch wrapper, auth headers, rate limiting, gzip decompression
  │    └─ endpoints/   — auth · game · user · leaderboard · experimental
  └─ SocketClient      — WebSocket lifecycle, reconnect (exponential backoff), sub ref-counting
       └─ MessageParser — plain-text commands and JSON-array messages, gzip via DecompressionStream
DataStores             — RoomStore · UserStore · ServerStore (extend TypedStore → EventTarget)
Cache                  — two-tier: in-memory Map + optional StorageAdapter, namespaced by server hostname
StorageAdapter         — binary interface (Uint8Array); IndexedDBStorage · FileStorage · NullStorage
```

## Key design decisions

**ScreepsClient** is the only entry point consumers instantiate. `connect()` authenticates via the injected `AuthStrategy`, then opens the WebSocket. The `WebSocket` constructor can be injected for Node 18/20 compatibility.

**Auth strategies** (`TokenAuth`, `PasswordAuth`) implement `AuthStrategy.authenticate(http) → Promise<string>`. Adding a new strategy requires no changes to `HttpClient`.

**DataStores** each extend `TypedStore<EventMap>` → `EventTarget`. `store.on(type, handler)` returns a `Subscription` (`{ dispose() }`). `SubscriptionGroup` composes multiple subscriptions for batch teardown — maps to `onCleanup` (SolidJS) or `onDestroy` (Svelte).

**Room objects**: first WebSocket message = full state; subsequent = diffs. `RoomStore` merges diffs internally.

**Terrain**: `Uint8Array(2500)` — 1 byte per tile (values 0–3) — in memory and raw binary in storage. No JSON/base64.

**Cache namespacing** derived from server URL hostname, preventing collisions across servers.

## HTTP endpoints (grouped under `HttpClient`)

- `http.auth` — signin, me, queryToken
- `http.game` — room data, game time, shard info
- `http.user` — user profile, console, branches
- `http.leaderboard` — rankings, seasons
- `http.experimental` — experimental API endpoints

## Testing

Tests in `screeps-connectivity/tests/`, mirroring `src/`. Environment: Node + Vitest + `fake-indexeddb`.

```sh
pnpm test                                              # from screeps-connectivity/
npx vitest run tests/socket/SocketClient.test.ts       # single file
```

## Full API reference

See `docs/screeps-connectivity.md`.