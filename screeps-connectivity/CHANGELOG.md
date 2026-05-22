# Changelog

## 0.2.1

### Patch Changes

- e761c02: Add `status` field to `MapStatsRoomData` so consumers can detect out-of-borders and restricted rooms. The client gains a "Show unclaimable rooms" toggle that highlights corridors, sector centres, owned rooms, and restricted areas on the world map.

## Unreleased

### Breaking Changes

- **`RoomStore.subscribeMap2()` removed** — use `client.stores.map.subscribeMap2()` instead.
- **`RoomStore.map2data()` removed** — use `client.stores.map.map2data()` instead.
- **`room:map2update` event moved from `RoomStore` to `MapStore`** — update `store.on('room:map2update', ...)` calls to use `client.stores.map.on('room:map2update', ...)`. The payload now includes a `source: 'live' | 'cache'` field.

### New Features

#### `MapStore` (`client.stores.map`)

- `subscribeMap2(room, shard)` returns a `Map2Subscription` with `status()`, `cachedData()`, and `onStatusChange()`.
- Configurable subscription limit via `ScreepsClientOptions.map2.maxSubscriptions` (default 500). Rooms beyond the limit are placed on a FIFO waitlist and promoted automatically as slots free.
- Diff detection: identical successive server messages do not emit `room:map2update`. Dedup uses a canonical JSON hash cached on the active entry, so each incoming message is canonicalized only once (not once per side).
- `room:map2update` event now carries `source: 'live' | 'cache'`. On subscribe, cached data is emitted immediately (microtask) with `source: 'cache'` so subscribers can render stale state before the first live tick arrives.
- `room:map2state` event emitted when a room transitions between `'pending'` and `'active'`, including on WebSocket reconnect.
- Persistent two-tier cache via `Map2Storage` (memory + IndexedDB). Up to `map2.maxCacheEntries` rooms cached with LRU eviction (default 10 000).
- Automatic reconnect handling: all active and pending subscriptions re-emit `room:map2state` after reconnect, and the per-room dedup hash is reset so the first live `room:map2update` after every reconnect is guaranteed to fire (even when the resent payload is identical to the last one seen).

#### `NavigationStore` (`client.stores.navigation`)

- `navigateTo(room, shard)` — append to bounded history (default 50 entries).
- `back()` / `forward()` — move within history; return `false` at boundaries.
- `canBack()` / `canForward()` — synchronous state queries for enabling/disabling UI buttons.
- `current()` — snapshot of current room, shard, index, and history.
- `navigation:change` event emitted on every navigation action.

#### `ScreepsClientOptions`

- New `map2` option: `{ maxSubscriptions?: number; maxCacheEntries?: number }`.
- New `tokenRefresh` option: `{ intervalMs?: number } | false` (default `{ intervalMs: 30_000 }`). Issues a lightweight `auth/me` request after `intervalMs` of HTTP idleness to keep the session token alive; any real HTTP traffic resets the idle clock. Pass `false` to disable.

#### Token lifecycle

- `HttpClient` and `SocketClient` token are now kept in sync. `HttpClient` rotations (via `x-token` header) propagate to `SocketClient` via the new `socket.setToken()` method, and WS auth-token rotations propagate back via the new `socket:tokenRefresh` event. Previously the two could drift, causing the WS to attempt reconnects with stale tokens.
- New public methods `HttpClient.setToken(token)` and `SocketClient.setToken(token)`.
- New event `socket:tokenRefresh` emitted from `SocketClient` when the `auth ok` reply contains a token. `ScreepsClient` listens to both `http:tokenRefresh` and `socket:tokenRefresh` and forwards rotations to the other transport automatically.
