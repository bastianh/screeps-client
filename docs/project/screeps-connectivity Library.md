---
title: screeps-connectivity Library
type: note
permalink: screeps-client/project/screeps-connectivity-library
tags:
- library
- typescript
- websocket
- http
- stores
---

# screeps-connectivity Library

The core networking and state library for interacting with Screeps game servers. Has zero production dependencies — it relies only on native platform APIs (fetch, WebSocket, DecompressionStream, IndexedDB). Published as both ESM and CJS via tsup. Version 0.2.4.

The single consumer-facing entry point is `ScreepsClient`. Instantiate it with a `url`, an `AuthStrategy`, and an optional `StorageAdapter`. Call `connect()` to authenticate and open the WebSocket, then access data via `client.stores.*`.

## Architecture

```
ScreepsClient
  ├─ HttpClient         — fetch wrapper; injects auth headers, rate-limits, decompresses gzip
  │    └─ endpoints/    — auth · game · user · leaderboard · power-creeps · register · user-messages · experimental
  └─ SocketClient       — WebSocket lifecycle, exponential-backoff reconnect, subscription ref-counting
       └─ MessageParser — parses plain-text commands + JSON-array messages; gzip via DecompressionStream
DataStores (extend TypedStore → EventTarget)
  ├─ RoomStore          — terrain + live room objects via WS subscription; diff merging; flag parsing
  ├─ UserStore          — user profile, world status, user stream (includes flags, notifications)
  ├─ ServerStore        — server version, world info, disconnect/reconnect events
  ├─ MapStore           — world map tile subscriptions (Map2 protocol), batched up to 500 rooms
  ├─ MapStatsStore      — per-room stat overlays fetched over HTTP
  └─ NavigationStore    — breadcrumb/history of visited rooms
Cache (two-tier)
  ├─ in-memory Map      — keyed by `${hostname}/${key}`, instant access
  └─ StorageAdapter     — binary (Uint8Array); implementations: IndexedDBStorage · FileStorage · NullStorage
```

## Key design decisions

**Auth strategies** implement `AuthStrategy.authenticate(http) → Promise<string>`. Four built-ins: `TokenAuth`, `PasswordAuth`, `SteamTicketAuth`, `GuestAuth`. Strategy pattern means no changes to `HttpClient` for new auth methods.

**Token sync**: `ScreepsClient` wires HTTP ↔ WebSocket token propagation so whichever side receives a new token keeps the other side current. An idle keep-alive timer (default 30 s) refreshes the token via a lightweight `auth/me` call when no HTTP activity has occurred.

**RoomStore subscription ref-counting**: `subscribe(room, shard)` returns a `Subscription` (`{ dispose() }`). Multiple callers can subscribe to the same room; the socket channel is only unsubscribed when the last ref is disposed.

**Room diff merging**: First WebSocket message for a room = full state. Subsequent messages = sparse diffs. `RoomStore` merges diffs into the object map. Flags come in a separate pipe-delimited string (`name~color~secColor~x~y|...`) and are only re-parsed when the string changes.

**Terrain**: stored as `Uint8Array(2500)`, 1 byte per tile (values 0–3). Persisted raw binary — no JSON/base64 overhead. Cache key: `terrain/${shard}/${room}`.

**`SubscriptionGroup`**: composes multiple `Subscription` objects for batch teardown. Maps to SolidJS `onCleanup` or Svelte `onDestroy`.

**Cache namespacing**: derived from server URL hostname, preventing cross-server collisions.

**WebSocket injection**: `ScreepsClientOptions.WebSocket` accepts a custom constructor for Node 18/20 compatibility.

## HTTP endpoints

| Group | Methods |
|---|---|
| `http.auth` | signin, me, queryToken |
| `http.game` | roomTerrain, roomsTerrain (bulk), roomObjects, gameTime, shardInfo |
| `http.user` | profile, console, branches, orders, memory |
| `http.leaderboard` | rankings, seasons |
| `http.experimental` | experimental API endpoints |

## Testing

Vitest, Node environment, `fake-indexeddb` polyfill. Tests mirror `src/` directory structure under `tests/`.

```sh
pnpm test                                              # from screeps-connectivity/
npx vitest run tests/socket/SocketClient.test.ts
```

## Observations
- [architecture] ScreepsClient is the only public entry point — consumers never instantiate HttpClient or SocketClient directly
- [design] Zero production dependencies; native platform APIs only
- [design] Stores extend TypedStore<EventMap> → EventTarget; use store.on(type, handler) returning Subscription
- [design] StorageAdapter is a binary interface (Uint8Array); pluggable: IndexedDBStorage, FileStorage, NullStorage
- [api] Exported from package root and additionally from `screeps-connectivity/file-storage` sub-path
- [version] 0.2.4

## Relations
- part_of [[Screeps Client Monorepo Overview]]
- consumed_by [[screeps-client Frontend]]
