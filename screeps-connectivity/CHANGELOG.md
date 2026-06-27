# Changelog

## 0.8.0

### Minor Changes

- fb4ab0a: Add a read-only Market section — all orders, my orders, and history — matching the vanilla client.

### Patch Changes

- 620f551: Add Power Creeps pages — list, create, and per-creep power upgrades — from the Overview page.

## 0.7.0

### Minor Changes

- 69d132d: Add an account Overview page (GCL/GPL rings, lifetime stats, per-room minimap previews) and a public Profile page with routing between them; optional dashboard endpoints (`user/overview`, `user/rooms`) now fail silently on servers that don't implement them.

## 0.6.0

### Minor Changes

- 71ce50f: Show reservation vs. owner, RCL, and the controller sign in the world-map tooltip.
- f525f2b: Replace the top-right logout button with a username chip (badge + name) that opens an account dropdown. The dropdown holds Settings, Respawn (with a destructive confirmation dialog), Change/Set password, and Logout. Password management works for email/password and Steam sessions — Steam-only accounts without a password get a "Set password" flow — while pasted API-token and guest sessions hide it. Settings now opens from the dropdown (guests keep the header gear); the panel's existing close button is the only toggle. Trimmed the Settings panel of options already available directly in the room/map views (creep labels, map view options) and removed the "Verbose creep details" toggle — the body-part breakdown is now always shown.

  `screeps-connectivity`: `UserInfo` gains an optional `password?: boolean` field, surfaced from `/api/auth/me`, indicating whether the account has a password set.

### Patch Changes

- 270fabf: Deep-merge room-object diffs so structure stores keep non-energy resources across ticks.

## 0.5.2

### Patch Changes

- 9523f3c: Make highway resources easier to spot on the world map. Power banks are now
  drawn as larger bright-red dots (radius 1.5 → 2.5) instead of small orange ones,
  and deposits — previously rendered as tiny muted-red "foreign" dots because
  their `d` map2 key fell through to the generic user-object path — now show as
  prominent white dots. The deposit key is documented on `RoomMap2Data`.

## 0.5.1

### Patch Changes

- 36673a3: Add `Game.map.visual` rendering support. The map view now subscribes to the `mapVisual` WebSocket channel and renders player-drawn map visuals (lines, circles, rects, polys, text) on the world map canvas using PixiJS.

## 0.5.0

### Minor Changes

- 1e7161f: Add `http.game.roomHistory(room, time, shard?)` to `GameEndpoints` — handles both official server (path-based URL) and private server (query-param URL) automatically. `HistoryPlayer` in `screeps-client` is refactored to use this endpoint instead of a raw `fetch()` with manual token injection.

## 0.4.0

### Minor Changes

- de4fd47: Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

  `screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.

## 0.3.0

### Minor Changes

- 9c24c2f: Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

  `screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.

### Patch Changes

- 31e9570: Fix destroying roads and walls in the property viewer when the user owns the room.

  Roads and walls carry no `user` field, so the destroy button was never shown.
  The fix falls back to `roomOwner().userId` for ownerless structures and
  correctly passes `room`, `roomName`, and an optional `shard` in the
  `destroyStructure` intent — matching the format the official client sends.
  `addObjectIntent` in `screeps-connectivity` now accepts an optional `shard`
  parameter.

## 0.2.4

### Patch Changes

- 0bd54f3: Add badge editor modal to settings panel with color picker, design selector, and variation controls. Export badge color utilities from library for use in UI components.

## 0.2.3

### Patch Changes

- b14a86d: Fix foreign creep badge and username display in observed rooms.

  When observing a room from another player, newly spawned creeps weren't showing
  the owner's badge and displayed player ID instead of username. Fixed by:

  - Merging user data across ticks instead of replacing, preserving player info
  - Adding `badge?: Badge` to the users type throughout the codebase
  - Adding `refreshForeignCreepBadges()` to update creep visuals when badge data arrives

## 0.2.2

### Patch Changes

- a42c89c: Guard against null or missing `objects` field in room update messages, and catch listener errors in `SocketClient.emit` so a bad listener cannot trigger a fatal socket error and kick the user out.

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
