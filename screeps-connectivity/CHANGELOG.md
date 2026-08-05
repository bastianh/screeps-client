# Changelog

## 0.19.0

### Minor Changes

- 01a3551: Offer badge symbols granted by decorations in the badge editor. A worn `badge`-type decoration (xxscreeps decorations mod) grants an svg symbol; the badge editor now lists those beside the 24 numbered shapes and saves them through the existing `/api/user/badge` route. `ApiRoomDecorationDef` gained the `badge` field and the `BadgeSymbol` type is exported.
- 7d2e2f4: Add a "Disable email notifications" checkbox to the OAuth registration form (Steam, Discord, ...). Mirrors the official client's registration option, but instead of dropping the email entirely it posts `{ disabled: true }` to `/api/user/notify-prefs` right after `set-username`, so the address stays on the account for login/recovery while notification emails are off from day one. `setNotifyPrefsWithToken` is exported from screeps-connectivity for bare-token use before a client session exists; the call is best-effort and never blocks the login.
- e74c83c: Upload and manage binary WebAssembly modules in the code editor. The module list gains an upload button for `.wasm` files; a binary module shows up as `<name>.wasm` and opens a summary panel (size, download, replace) instead of the text editor. On save it is sent through `/api/user/code` as a `{ binary: <base64> }` value, the format the official server stores WASM modules in. screeps-connectivity now types the code endpoints: `code.get` returns the new `ApiUserCodeResponse`, and `code.set` plus the `user:code` socket event carry `ApiCodeModule` (`string | { binary: string }`) — both types are exported.

## 0.18.0

### Minor Changes

- e33e5fc: Keep room decorations live.

  Room tick messages can carry a `decorations` field. `RoomStore` now forwards it as a new
  `room:decorations` event, and the room view merges those items by `_id` into the list it fetched
  over HTTP — so a decoration placed or edited while you are watching the room appears without a
  reload. The merge returns the previous list untouched when nothing actually differs, so a server
  that repeats the same payload every tick does not rebuild the decoration layer.

- 5a0355a: Bring world-map decorations up to the reference client.

  `map-stats` returns decoration definitions in a top-level dictionary keyed by the id each room
  stat references. That dictionary was previously discarded, so the map had to guess what a
  decoration was from its colour properties and could only ever tint plains and swamps. It is now
  resolved, which brings the map wall colour, both landscape overlay textures and graffiti.

  Colours follow the reference map layer's maths: each layer is desaturated by its own factor (0.48
  for walls, 0.5 for floors, 0.75 and 0.35 for the overlay textures) so a decorated room still reads
  as a map tile. Swamps mix 70% of the already-desaturated plain colour with 30% of the raw swamp
  colour.

  The road colour was being stored but never drawn — it now tints the map's road overlay.

  **Breaking (`screeps-connectivity`):** `MapStatsRoomData.terrainColors` and the `TerrainColors` type
  are replaced by `MapStatsRoomData.decorations` and the `MapRoomDecorations` / `MapLandscape` /
  `MapGraffiti` types. The store now reports raw decoration values and leaves the colour maths to the
  renderer.

- 268b592: Show room decorations in the sidebar and on the selected creep.

  The sidebar lists the decorations placed in the current room — landscapes, graffiti and object
  overlays — with their preview image, type and owner. Selecting a creep now shows which creep
  decorations actually apply to it, reusing the renderer's own owner and `!SEP!` name-filter matching
  so the panel cannot drift away from what is drawn.

  `screeps-connectivity` gained `user.decorations.inventory()` and `user.decorations.themes()`, plus
  the `ApiUserDecorationItem` and `ApiDecorationTheme` types and the display fields of a decoration
  definition (`name`, `rarity`, `theme`, `restricted`, `preview`, `groupDescription`).

- 4b3412e: Place and remove decorations from the inventory.

  Clicking a decoration opens an editor for its properties — colours, ranges, checkboxes, the
  animation preset, and the creep name filter with its `exclude` inversion — plus the target room,
  and activates or deactivates it.

  The room picker disables rooms that already hold a clashing decoration, following the reference
  client's rules: the combined `landscape` type blocks both halves, a wall and a floor landscape
  coexist, skins and object overlays clash only with their own type, and graffiti is unrestricted.
  Creep and badge decorations are account-wide and skip the room picker entirely.

  Geometry shows as numeric controls for now; dragging a decoration around a room preview follows.

  `screeps-connectivity` gained `user.decorations.activate()` / `.deactivate()`, a `reservation`
  flag on `user.rooms()`, and the `ApiDecorationProp` / `ApiDecorationProps` schema types.

- f31e5c8: Send the shard with flag-name lookups. `genUniqueFlagName()` and `checkUniqueFlagName()` now take an optional `shard`, and the client passes the shard of the room being viewed. Without it, official multi-shard servers rejected both calls with `invalid shard`, so the flag form could not generate or validate a name.

  `addGlobalIntent()`, `setNotifyWhenAttacked()`, `createInvader()` and `removeInvader()` gained the same optional `shard` argument — the official client sends one on all four, and they were previously unusable on multi-shard servers for the same reason.

  `tick()` also takes an optional `shard`, and with one it queries the official server's per-shard route `/api/game/shards/tick` instead of the shardless `/api/game/tick`, which only private servers provide. Calls without a shard are unchanged.

- c4d9b82: Room decorations: rework the parsing foundation ahead of graffiti/creep/object rendering.

  - Decoration `brightness` props now scale HSL lightness like the official renderer instead of
    multiplying RGB channels — floor, wall, road and texture colours were visibly off whenever
    brightness was below 1.
  - Landscapes are first-wins per room (matching the reference renderer) instead of last-wins, and
    the combined `landscape` type is finally recognised as both a floor and a wall landscape.
  - Graffiti, creep and object decorations are parsed into typed lists (sprites with their
    `color`/`alpha`/`visible` prop references resolved, `!SEP!` name filters split, animation names
    validated). Rendering for them follows in a later change.
  - Turning the "room decorations" setting back on now re-fetches immediately instead of waiting for
    the next room change.
  - Decoration textures load through a shared, deduplicating cache.
  - `ApiRoomDecorationDef` gained the `landscape` and `badge` types plus `tiling`/`objectType`;
    `ApiRoomDecorationActive` gained the geometry, animation and targeting fields.

### Patch Changes

- 552bb32: Render `wallGraffiti` room decorations.

  Graffiti images now draw between the terrain and the objects, masked to the room's walls, with
  tint, per-graphic alpha, tiling, rotation and horizontal flip applied. The five alpha animations of
  the official renderer (`slow`, `fast`, `blink`, `neon`, `flash`) are driven off a single ticker
  callback, and `lighting`-enabled items are drawn a second time above the darkness overlay so they
  stay bright — the same trick the reference renderer's separate lighting layer performs.

  `ROOM_DECORATIONS_MOCK` gained a synthetic `wallGraffiti` entry so the path can be exercised
  without owning one.

## 0.17.0

### Minor Changes

- 6f45a4b: Add the world and power leaderboards.

  **screeps-client** — a new Leaderboard page (`/leaderboard/<mode>`) reachable from
  the header, modeled on the official client's Expansion Rank and Power Rank lobby
  pages: season picker, paged ranking table with badges linking through to player
  profiles, a name search that jumps to a player's page, and a "your rank" chip.
  Opening it without a page lands on the row of the player you're looking for —
  yours, or the one you searched or linked to. The account Overview and public
  Profile pages now show clickable current-month rank tiles that open the table on
  that row.

  **screeps-connectivity** — `http.leaderboard.list()` now takes an options object
  (`{ mode, season, limit, offset }`) instead of four positional arguments,
  `seasons()` accepts an optional mode, and `find()` omits `season` rather than
  sending an empty one so it returns every ranked season. All three routes are
  silent, since not every private server keeps ranking tables. Adds the
  `currentLeaderboardSeason()` and `normalizeLeaderboardRank()` helpers plus
  `LeaderboardMode`, `ApiLeaderboardEntry` and `ApiLeaderboardUser` types.

## 0.16.0

### Minor Changes

- f218429: Embedded clients are now configured from the first frame with no `/api/version` round-trip: both the xxscreeps mod and the classic server mod prefetch the version payload and inline it into the page (`window.__SCREEPS_BOOTSTRAP__`), and the client seeds it into both the pre-login UI and the connection. `ScreepsClient` gains an `initialVersion` option and `ServerStore` a `seedVersion()` method to support this.

## 0.15.2

### Patch Changes

- b39a0c1: Fix duplicated console output when multiple parts of the app subscribe to the same `UserStore` channel. `subscribe()` now installs a single shared, ref-counted socket subscription and listener per channel instead of one listener per caller, so each incoming frame is processed and re-emitted exactly once. The server subscription and listener are torn down only after the last subscriber disposes.

## 0.15.1

### Patch Changes

- 4526471: Namespace the pre-login `/api/authmod` session cache by host **and path**, not hostname alone. Behind `screeps-client-proxy` every backend is wrapped under one host (`localhost/(https://server)`), so hostname-only keys collided and one server's auth capabilities could be shown for another. Also disambiguates private servers that share a hostname on different ports. Matches the path-based namespacing already used for the persistent cache in `ScreepsClient`.

## 0.15.0

### Minor Changes

- 66f88f8: Code panel branch management: create a new branch (clones the selected branch, with an inline name input) and set the selected branch to run on the server. The active-branch indicator now stays live via a new `set-active-branch` WebSocket subscription — `UserStore.subscribe('set-active-branch')` emits a `user:setActiveBranch` event whenever the active branch changes, including from another client or session.

  The code panel can now add and delete modules: an add button in the module list opens an inline name input, and hovering a module reveals a delete button (the `main` entry module is protected). Both changes are staged locally and persisted on the next Save.

  Also fixes a stale-response race in the code panel where switching branches while a previous branch's code fetch was still in flight could leave the editor showing the wrong branch's files.

- 66f88f8: WebSocket compression support (opt-in): setting the new `ScreepsClientOptions.gzip` to `true` sends `gzip on` after auth, so the server deflates event frames (room updates, map stats, memory) and only transmits the compressed `gz:` form when it's actually smaller. Defaults to `false` to match the official client, which never enables it. The `gz:` decode path is always active regardless, so this is a pure opt-in bandwidth trade with no downside on small control frames.

## 0.14.0

### Minor Changes

- 57a7e1d: Hide the connection ("server") password field for xxscreeps servers.

  `screeps-connectivity` adds a `hasOfficialLike(version)` capability helper that
  detects the `official-like` feature advertised at `/api/version`. The login
  screens (web and desktop) now use it to hide the server-password field on
  xxscreeps servers, where the screepsmod-auth connection password does not apply.

### Patch Changes

- 5d46b8e: Fix flag removal and color changes failing with "invalid shard" on multi-shard servers. `removeFlag` and `changeFlagColor` now accept and forward the current shard, matching the other room-scoped game endpoints.
- 3b9b951: Revamp the public profile page (`/profile/<username>`):

  - Header now mirrors the self Overview chrome — small badge, the player's name
    as the title, and a compact GCL/GPL readout rendered as rounded chips bordered
    in the rank color (teal / red).
  - The "Last 7 days" stat block is now a dropdown (1 hour / 24 hours / 7 days);
    the tiles refetch the user's public stats for the selected window.
  - Stat tiles now render correctly on servers that return `/api/user/stats`
    metrics as a single pre-summed total per interval, not just per-tick buckets
    (`ApiUserStatsResponse.stats` widened to `number | bucket[]`).
  - Cross-links between the two account views: the username on the self Overview
    links to the public profile, and your own public profile links back to your
    private Overview.
  - The top-bar Overview button no longer appears active while a profile is open —
    a profile is a separate view.

- 79bd3d0: Add a read-only per-room overview page at `/room-overview/<shard>/<room>` (or
  `/room-overview/<room>` on single-shard servers):

  - Header with the room name, owner (badge + profile link, or "Unclaimed room"),
    and a room minimap thumbnail that opens the live room view.
  - The same seven stat tiles as the account Overview, summed over a selectable
    interval (1 hour / 24 hours / 7 days).
  - A history graph rendering the six per-bucket metrics (energy harvested,
    construction, control, energy on creeps, creeps produced/lost) as
    opacity-scaled dot strips.
  - Entry points: a chart button next to each room name on the self Overview and
    public Profile pages, plus a button in the in-game room view's left toolbar
    (between the World Map and History buttons).
  - `screeps-connectivity`: the existing `game.roomOverview` endpoint is now typed
    with the new exported `ApiRoomOverviewResponse` (was `unknown`).

## 0.13.1

### Patch Changes

- 661a53f: Don't show the "Connection lost" modal after an intentional disconnect. A guest hitting Login (or any user logging out) tore the session down synchronously, but the socket's async `onclose` still fired `server:disconnected` with `willReconnect: false`, which re-raised a fatal session error over the login screen. The disconnected event now carries an `intentional` flag so the client can distinguish a user-initiated close from a genuinely lost connection.
- 9bc39f8: History viewer fixes and a couple of supporting connectivity additions:

  - Render terrain when reloading directly into history mode. Terrain loading was gated behind the room-subscription effect, which is skipped in history mode, so a fresh reload into a `#tick=` URL showed no terrain. Terrain/decoration loading now runs independently of history mode.
  - Open the history view at the start of the previous, fully-written chunk instead of the current tick (whose chunk isn't flushed yet), avoiding an immediate 404 + fallback round-trip.
  - Suppress the red failure toast when a history chunk is missing (404). `roomHistory` requests are now `silent`, and the viewer shows an in-room "No data available for this tick" hint instead, prompting the user to pick another tick from the timeline.
  - During playback, skip to the start of the next chunk when the current chunk is missing, instead of re-fetching the same non-existent file on every tick.
  - Expose `serverData.historyKeepTicks` (non-official field from the xxscreeps history mod) on the version types, used to size the history timeline's replayable range (falls back to a default window when absent).
  - HTTP errors thrown by `HttpClient` now carry a `status` property so callers can distinguish a 404 from other failures.
  - Dev-only: proxy `/room-history` to `VITE_PROXY_TARGET` in the Vite dev server.

- 1e85697: Accept the xxscreeps `{ error: "actually, it was fine" }` sentinel (returned with status 200 by the `create-construction` route to signal success) as a successful response instead of throwing.

## 0.13.0

### Minor Changes

- 94a6658: Add Discord OAuth login: getDiscordFeature() helper in screeps-connectivity, and a "Login with Discord" button in the web and desktop login forms.

### Patch Changes

- 46b5e2d: Fix Steam/password logins silently expiring after ~5 minutes on screepsmod-auth servers. These logins reconnect via a rotating, TTL-limited session token, but `TokenAuth` was hard-coded to ignore the server-issued `X-Token`, so the client kept replaying the original token until the server expired it — surfacing as a sudden `401` on `/api/user/world-status` (and every other authed request) even while actively using the client.

  `TokenAuth` now accepts `supportsTokenRefresh` (default `false`, preserving durable personal-API-token behavior). The client enables it for Steam/password-derived session tokens so the rotated `X-Token` is adopted on every response, keeping the session alive.

## 0.12.0

### Minor Changes

- 8fd1a08: Fix Steam login failing with "auth failed" on brand-new accounts (e.g. xxscreeps). Some servers hand back a provisional token for a first-time OAuth signup that can't authenticate the websocket until a username is chosen; the login flow now detects this via `/api/auth/me` and prompts for a username before connecting. Adds `fetchAuthMeWithToken` and `completeProviderRegistration` to `screeps-connectivity`.
- b26940a: xxscreeps-mod-client now publishes an `xxscreeps-mod-client` server feature at `/api/version` reflecting `.screepsrc.yaml`'s `backend.allowGuestAccess`, `backend.allowEmailRegistration`, and `backend.steamApiKey`. screeps-client reads this via the new `getXxscreepsModClientFeature` helper (screeps-connectivity) to show or hide the Guest, "Create account", and "Login with Steam" options to match what the server actually allows, instead of guessing.

### Patch Changes

- 594073a: Fix cache/storage namespace collision when two distinct game worlds are hosted under the same domain via a path (e.g. Screeps World vs Screeps Season on screeps.com) — terrain and other cached data no longer bleed between them.
- 15d0c1f: Show a dismissable popup (reload/logout) instead of silently bouncing to the login screen when an already-connected session hits a fatal socket error or disconnect. Add a similar popup for 429 rate-limit responses from official servers, with a button to open the server's "disable rate limiting" link (opens the OS browser in the desktop app). Fix the map view not reloading terrain when switching shards — room names collide across shards, so the renderer's terrain cache was serving stale terrain from the previously viewed shard. Also removes the 5-minute sessionStorage cache on `fetchServerVersion` so the pre-login welcome screen always reflects the server's current `/api/version`.

## 0.11.0

### Minor Changes

- cc7f5be: Add `MapStatName`, `MapStatPrefix`, `MapStatInterval` const objects and `mapStat()` helper for typed map-stats API access; add `TerrainColors` interface and decoration fields to `MapStatsRoomData`; expose `MapStatsStoreEvents` and `statName` in room events.

  Client: world map shard selector, "out of borders" black overlay, reveal-when-ready terrain/stats sync, mineral overlay on demand, room terrain decorations from player themes.

## 0.10.0

### Minor Changes

- 1539f52: Add NotifyPrefs type and notifyPrefs field on UserInfo for email notification preference support.
- de39cf0: Expose public-profile data through the API: `power` on the `user.find` response, an optional `id` argument on `user.stats`, and a typed `leaderboard.find` response.
- 4b8f9d9: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

### Patch Changes

- 882bea5: Fix `TokenAuth` always using its static token — server-issued `X-Token` headers, WebSocket token rotation, and the idle keep-alive timer are now skipped when the auth strategy sets `supportsTokenRefresh: false`.

## 0.9.0

### Minor Changes

- e73c85f: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

## 0.8.1

### Patch Changes

- f29f9a8: Fix world bounds calculation for single-quadrant maps (e.g. E/S-only servers) — previously the client assumed a symmetric world and mapped e.g. E0S0–E11S11 to W6N6–E5S5.

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
