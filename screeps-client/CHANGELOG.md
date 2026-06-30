# screeps-client

## 0.13.0

### Minor Changes

- 1539f52: Add Notifications section to Settings panel with email notification preferences: master enable/disable toggle, send interval, send-when-online, error notification interval, and new-message notification controls.
- e5b16a1: Refactor top-level navigation to use an overlay system: overview, profile, market, and settings now slide over the game canvas (preserving map position/zoom) instead of replacing the full page. Adds a shared `OverlayPage` template component. The map button moves into the room view as a floating corner button. Badge picker is accessible directly from the user menu dropdown.
- de39cf0: Make player usernames clickable everywhere they're shown (room selection panel, map room-info box, room-info panel) and rebuild the public profile into a full account dashboard: GCL/GPL rings, current-month leaderboard ranks, last-7-days stat tiles, and owned-room minimaps.
- abe0e3d: Spawn shows owner-badge background, energy-scaled core, and layers spawning creeps behind it.

### Patch Changes

- 4b8f9d9: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

## 0.12.2

### Patch Changes

- e73c85f: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

## 0.12.1

### Patch Changes

- db24504: Rebuild against screeps-connectivity 0.8.1 to include the single-quadrant world-bounds fix.

## 0.12.0

### Minor Changes

- fb4ab0a: Add a read-only Market section — all orders, my orders, and history — matching the vanilla client.
- 6d383dc: Add power bank room rendering (animated red ellipse inside an octagonal shell, sized by stored power) and a property panel showing power amount, hits, and ticks until decay.
- 620f551: Add Power Creeps pages — list, create, and per-creep power upgrades — from the Overview page.
- e0dac0b: Show stored power as a sweeping ring on the power spawn, matching the vanilla client.
- 3c7b10f: Pulse a terminal's four triangles while it's on send cooldown, matching the vanilla client.

## 0.11.0

### Minor Changes

- 58ba2bc: Render invader creeps as a red gem, matching the vanilla client.
- 2e21be5: Pulse a lab ring glow during reaction cooldown, and key the factory glow off absolute cooldownTime.
- 69d132d: Add an account Overview page (GCL/GPL rings, lifetime stats, per-room minimap previews) and a public Profile page with routing between them; optional dashboard endpoints (`user/overview`, `user/rooms`) now fail silently on servers that don't implement them.

### Patch Changes

- 97d6fdf: Spin the extractor ring only while on cooldown, matching vanilla.
- 2e67d21: Remove leftover debug logging from the memory store's user:memory handler.

## 0.10.0

### Minor Changes

- cb2129e: Animate lab reactions with converging white beams from the input labs to the output lab.

## 0.9.0

### Minor Changes

- e020835: Render mineral extractors as a continuously rotating ring (one full turn every 12s) drawn above the mineral: three gapped arc segments drawn procedurally with Graphics — no atlas frame, so it stays crisp at every zoom level. The ring is tinted by room ownership — owner green when the room is yours, hostile red when owned by someone else, and neutral grey when the room is unowned.
- 71ce50f: Show reservation vs. owner, RCL, and the controller sign in the world-map tooltip.
- 70c7dfb: Draw ramparts as a translucent overlay above structures and creeps with a glowing rim, plus a spawn progress ring.
- 0e72b67: Fill terminals, labs, nukers, and factories by stored resource, with storage/container resource bands sharing the mineral colour palette.
- f525f2b: Replace the top-right logout button with a username chip (badge + name) that opens an account dropdown. The dropdown holds Settings, Respawn (with a destructive confirmation dialog), Change/Set password, and Logout. Password management works for email/password and Steam sessions — Steam-only accounts without a password get a "Set password" flow — while pasted API-token and guest sessions hide it. Settings now opens from the dropdown (guests keep the header gear); the panel's existing close button is the only toggle. Trimmed the Settings panel of options already available directly in the room/map views (creep labels, map view options) and removed the "Verbose creep details" toggle — the body-part breakdown is now always shown.

  `screeps-connectivity`: `UserInfo` gains an optional `password?: boolean` field, surfaced from `/api/auth/me`, indicating whether the account has a password set.

### Patch Changes

- 8e12def: Only redraw walls and ramparts when they change, not every tick.
- dcc67d2: Fix room only partially loading when opened from the world map.
- d4dbba3: Poll world status frequently while waiting on a respawn or first-spawn placement so the client reacts almost immediately. When status is `lost` or `empty` the client now refreshes once a second instead of relying on the slow idle path, and triggering a respawn opens a short force-poll window that catches the state change even while the server still reports the old status.

## 0.8.0

### Minor Changes

- a40445a: Add structure energy visuals (spawn/link/source) plus link-transfer and creep-repair beams with impact glow.

## 0.7.4

### Patch Changes

- fc2a8e0: Keep the flag-creation name field stocked with a free name. After a flag is
  created the draft name is regenerated via `gen-unique-flag-name`, retrying with
  a short backoff so the server has time to register the new flag instead of
  handing back the name just used. When re-entering flag mode, the existing draft
  name is re-validated via `check-unique-flag-name` and regenerated if it has
  since been taken.
- 2e1c7fc: Support TexturePacker MultiPack sprite atlases. The default theme now loads only
  `sprite-0.json`; PixiJS follows `related_multi_packs` to pull in linked sheets,
  and `AtlasCache` merges frames from the spritesheet and its `linkedSheets` into
  one lookup so sprites split across multiple atlas pages render correctly.

  Render towers from the sprite atlas: a static `ring` tinted by ownership and a
  rotating `body` (the cannon), with the energy level drawn as a procedural rounded
  rect scaled by fill. When a tower attacks, heals, or repairs it now turns its
  barrel toward the target and draws a colored beam (red/green/cyan) for the action,
  then resumes its idle sweep from that position.

## 0.7.3

### Patch Changes

- 6262ce2: Cache-bust the sprite atlas JSON by client version. `public/` assets aren't
  content-hashed by Vite, so `themes/default/test.json` keeps a stable URL across
  releases and the embedded mod serves it without `Cache-Control` — browsers then
  cache it heuristically and keep stale frames after a spritesheet update (only
  the image inside the JSON carried a `?v=` hash). This left newly added sprites
  (e.g. deposits) blank on deployed servers while everything worked locally.
  Appending `?v=<clientVersion>` to the atlas URL forces a fresh fetch on each
  release; Pixi propagates the query to the atlas image, so resolution is
  unaffected.
- c7cf4bf: Use spritesheet sprites for minerals in both the room view and the map overlay.
  In the room view each mineral displays its type-specific sprite at 1.3× tile size.
  In the map overlay the sprite scales with density (density 1 is small, density 4 fills the room tile), replacing the previous coloured circle + letter glyph.

## 0.7.2

### Patch Changes

- b8cf7ec: Render deposits with proper artwork in the room view. The sprite atlas gains
  shape + fill frames for all four commodity types (biomass, metal, mist,
  silicon), and the renderer now draws a deposit as two stacked layers tinted by
  type using the official commodity colors. The fill layer is kept mostly
  transparent so the rock shape reads through. Falls back to the previous colored
  rectangle when no theme/atlas or an unknown deposit type is present.
- 3e90c89: Fix map rooms staying permanently black when zooming while terrain is still loading. `setRoomTerrain` captured the LOD at the start of the bake and only applied the texture if the LOD was still the same when the (async) bake finished — so zooming across the LOD threshold mid-bake left the sprite empty, yet the room was marked baked and never re-requested. Recovery was impossible because the raw terrain bytes were only kept at LOD 0, so `applyLOD` could never bake the missing LOD-0 texture for a room first baked at LOD 1.

  Raw bytes are now kept for every baked room (freed in `clearRoom`), and a shared `ensureCurrentLod` helper applies — or lazily bakes from raw — the texture for whatever LOD is current, both right after a bake and on every LOD change, in either zoom direction.

- 9523f3c: Make highway resources easier to spot on the world map. Power banks are now
  drawn as larger bright-red dots (radius 1.5 → 2.5) instead of small orange ones,
  and deposits — previously rendered as tiny muted-red "foreign" dots because
  their `d` map2 key fell through to the generic user-object path — now show as
  prominent white dots. The deposit key is documented on `RoomMap2Data`.
- b48571a: Make the room dark-overlay light pools follow creeps smoothly during movement.
  Lighting is now a GPU lightmap (a RenderTexture composited from a dark rect plus
  `erase`-blend light sprites) instead of a canvas re-baked once per tick, so each
  light tracks its creep's interpolated motion every frame instead of snapping at
  tick end — with no per-frame canvas redraw or texture re-upload.

## 0.7.1

### Patch Changes

- 36b7d97: Fix Safari/WebKit terrain tile caching (the real root cause this time). Reading a cached tile back via `Response.blob()` from the Cache API produced a blob whose `blob:` URL WebKit treats as cross-origin, so every decode — both `createImageBitmap(blob)` and the `HTMLImageElement` fallback — failed with `Cannot load blob:… due to access control checks`. On reload this surfaced as a flood of console errors and a stalling map. `getTerrainCacheBlob` now copies the cached bytes into a fresh, page-origin `Blob` (`arrayBuffer()` → `new Blob([...])`), which strips the taint so decoding works in every browser.
- 9581eb2: Fix slow, stuttering map terrain loading when zooming far out.

  - **No more main-thread freeze.** The cache-copy encode (`OffscreenCanvas` + `convertToBlob`) ran on the main thread once per baked tile; a batch of up to 200 rooms could lock up or completely hang the tab. The terrain worker now encodes the cache copy itself, off the main thread.
  - **Visible tiles no longer wait for caching.** The worker posts the baked bitmap back immediately and encodes + sends the cache copy as a separate follow-up message, so rendering is never gated behind the encode.
  - **No more duplicate fetches/bakes.** `hasRoom()` only turns true once a bake completes, so rooms already being fetched/baked were re-queued on every `visibleRooms` change, multiplying terrain requests and worker bakes. In-flight rooms are now tracked and excluded until their bake finishes.

  The now-unused `imageBitmapToBlob` helper is removed.

## 0.7.0

### Minor Changes

- cb3a324: Start directly in guest mode without flashing the login screen. When the client knows at boot that it will auto-connect — embedded xxscreeps mode (guest), a `?guest=` param, or a returning user with a stored token — it now shows a lightweight connecting splash instead of the `LoginForm` until the connection settles. The login form is only shown once the auto-connect attempt fails or when there is nothing to auto-connect.
- 9826156: Show the server message-of-the-day over the map in guest sessions. After connecting as a guest, the server's welcome text (the same HTML already shown on the login screen) appears centered over the map view, with a close button and a 15s auto-dismiss timer that pauses while the pointer is over it. It is shown once per session and never reappears after being dismissed.

### Patch Changes

- 67dc748: Fix blurry RoomVisuals text: replace PixiJS Text objects with a 2D canvas texture sized to `world.scale × devicePixelRatio × ROOM_SIZE`, giving a 1:1 physical pixel mapping at any zoom level. Eliminates GPU upsampling/downsampling that caused extreme text blur. Also fixes a crash (`source is null`) caused by `Texture.from` cache sharing; solved by always passing `skipCache: true` when recreating the texture on zoom changes.
- 2685f44: Fix two Safari/Firefox map view rendering bugs:

  - **Terrain tile caching never worked in Safari.** The Cache API write succeeded, but reading the cached WebP blob back via `createImageBitmap(blob)` failed in WebKit with an "access control checks" error (the internal `blob:` URL is treated as cross-origin). The error was swallowed and surfaced as a permanent cache miss, so every tile was re-baked. `blobToImageBitmap` now detects the gap once and falls back to decoding via an `HTMLImageElement` object URL, which works in every browser.
  - **Map view crashed when zoomed far out after a view switch** (`TypeError: null is not an object (evaluating 'r.addressModeU')`). `MapRenderer.destroy()` passed `texture: true` to `app.destroy()`, which also destroyed the globally shared `Texture.EMPTY` referenced by every empty/unbaked terrain sprite. The next renderer instance then crashed on rendering those tiles. Terrain textures are already destroyed manually, so `texture: true` was removed.

## 0.6.1

### Patch Changes

- 18c30de: Add animated fill-level rendering for containers. The container visual now shows a dark background with a filled rectangle that animates smoothly when store contents change.
- 6dd8ad7: Fix sprite atlas URL not resolving under `/client/` base path when running via `screeps-mod-client`. The atlas URL now uses `basePath()` so it is prefixed correctly for each build target.
- 36673a3: Add `Game.map.visual` rendering support. The map view now subscribes to the `mapVisual` WebSocket channel and renders player-drawn map visuals (lines, circles, rects, polys, text) on the world map canvas using PixiJS.

## 0.6.0

### Minor Changes

- d61f26f: - Add transfer action beam animation — creeps performing `transfer` now show an animated beam like harvest/build/upgrade
  - Add "Verbose creep details" toggle in Settings; when enabled the selection panel shows the full creep property list
  - Guest UI improvements: Code Editor button is hidden for guests; the Logout button becomes a green Login button in guest mode
  - Fix race condition in room URL effect when switching between map and room views

## 0.5.1

### Patch Changes

- f576993: Fix URL accumulation when navigating between room and map views in the xxscreeps build. The relative `BASE_URL` (`./`) used for the xxscreeps bundle was causing `basePath()` to return `'.'`, which made `history.pushState` calls use relative URLs that compounded `/room/` into the path on every navigation. Page reload also failed to parse the room from the URL for the same reason.
- 1e7161f: Add `http.game.roomHistory(room, time, shard?)` to `GameEndpoints` — handles both official server (path-based URL) and private server (query-param URL) automatically. `HistoryPlayer` in `screeps-client` is refactored to use this endpoint instead of a raw `fetch()` with manual token injection.

## 0.5.0

### Minor Changes

- de4fd47: Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

  `screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.

### Patch Changes

- f87b2a4: Fix unclaim, activateSafeMode and suicide buttons: all three sent an empty intent and a missing/undefined room. Now correctly sends room (currentRoom()), shard and intent: { id } as the official client does. Fix controller badge not updating when the room owner changes: the visual is now rebuilt whenever the owner field changes so the inner circle style and badge appear/disappear correctly.
- e018214: Render creep.say() messages as speech bubbles anchored to the creep, and interpolate creep movement linearly over the tick duration so motion stays smooth across slow ticks and history playback.
- 4e838c1: Use relative base path (`./`) for the xxscreeps embedded build so that asset references in `index.html` resolve relative to the served page URL. This ensures assets under `_client/` are requested at the correct subpath (e.g. `/client/_client/...`) regardless of where the mod mounts the client.
- 14a4f03: Fix flag move mode: setting the overlay action no longer re-triggers the room-change effect (was calling r.clear() + objLayer.destroy(), breaking rendering). Zoom is now preserved when navigating between rooms during a move. A "Target room" input in the flag detail panel lets you move flags to any room without navigating there first.

## 0.4.1

### Patch Changes

- 973e831: Rename Vite assets output directory from `assets/` to `_client/` to avoid collision with the game server's `/assets/` endpoint. The directory name is overridable via the `VITE_ASSETS_DIR` environment variable.

## 0.4.0

### Minor Changes

- 1f571fb: Add dedicated detail panels for controllers, extensions, and store structures in the selection sidebar. Controller panel shows RCL progress bar, safe-mode activation, and unclaim action. Extensions show energy fill and notify-when-attacked toggle. Storage, terminal, container, lab, factory, nuker, and powerSpawn show a fill level bar with per-resource breakdown. RoomInfoPanel now displays the current RCL percentage inline. Adds `y` keyboard shortcut for the memory panel.
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

## 0.3.5

### Patch Changes

- 31d438d: Fix stale visuals, selection data and duplicate chunk downloads in history mode; add instant-mode animations, debounced slider, URL hash permalinks (#tick=N), unified mode button row with Clock icon, and read-only action buttons in history mode. Restore road and rampart graphics after ObjectLayer.clear() so they remain visible when leaving history mode. Add Creep-Namen and Room-Visuals toggles to the room info panel. Fall back to the previous history chunk when the current one has not been written yet.

## 0.3.4

### Patch Changes

- 010e8c4: Add Memory tab to console panel with keyboard shortcut and flex-based split layout.
- 5e8af08: Fix crash when tracking creep ring overlays for destroyed PixiJS containers.
- cf6c9d7: Fix rooms outside world bounds being marked with the red unclaimable overlay and triggering unnecessary terrain/stats fetches. The visible-room list is now clamped to the world bounds rectangle, and a negative cache prevents re-fetching rooms the server returns no terrain data for.
- 7a20f8c: Fix crash when zooming out fast with uncached terrain tiles. A race condition caused the map renderer to destroy a terrain texture while the sprite still referenced it, leading to a PixiJS crash reading `alphaMode` from a null source. The sprite is now cleared before any texture it references is destroyed.
- 046b25c: Add room history mode: replay historical ticks via the screepsmod-history API with playback controls (step, play/pause, speed) in the sidebar and a timeline slider on the room canvas. Fix SPA catch-all in screeps-mod-client shadowing backend routes such as `/room-history` when the client is mounted at `/`.

## 0.3.3

### Patch Changes

- 0bd54f3: Add badge editor modal to settings panel with color picker, design selector, and variation controls. Export badge color utilities from library for use in UI components.
- c6cb87f: Add clear caches button in settings panel. Users can now clear IndexedDB, Cache API, and localStorage from the settings UI, with the page reloading afterwards. Session tokens are preserved.
- aa05da7: Integrate lucide-solid icon library. Replace Unicode fallback glyphs (✕ close buttons, ✓/✗ field indicators) with proper SVG icons from Lucide. Replace text labels in the dashboard header (Map, Code, Settings, Logout, nav arrows) with icon-only buttons and native browser tooltips.
- 45471d4: Improve map room ownership visualization with distinct overlays and enhanced room detail colors. Own rooms display with a blue overlay and green-tinted creeps/structures, while enemy-owned rooms display with a red overlay and muted red creeps/structures. Own walls render in green, foreign walls in red. Also fixes map mode to display by default when loading without a room and ensures map zoom persists only when viewing a specific room.
- 4375f2f: Add terrain visual effects: swamp glow (green atmospheric blur) and wall noise (rough stone grain overlay) with user-togglable setting in Settings panel.
- de6f984: Pre-render wall noise terrain as a texture sprite using the renderer. This improves rendering performance by avoiding per-frame NoiseFilter application on the wall noise graphics, and ensures proper cleanup of the generated texture on destroy.

## 0.3.2

### Patch Changes

- 64fcb46: Show the current client version in Settings and expose the embedded wrapper version for screeps-mod and xxscreeps deployments.
- f31f69e: Add two-finger pinch-to-zoom for the room view and world map view on touch devices. Zoom and pan work simultaneously during the pinch gesture. Also enables `touch-action: none` on the room canvas so the browser no longer interferes with pointer events.
- d86e8df: Fix rooms with no swamp tiles rendering entirely in swamp color.

  Calling `fill()`/`stroke()` on an empty PixiJS 8 path can reapply the style
  to the previous path context. Added a `pathDrawn` guard so the terrain
  stroke/fill is only applied when at least one tile was actually drawn.

- b14a86d: Fix foreign creep badge and username display in observed rooms.

  When observing a room from another player, newly spawned creeps weren't showing
  the owner's badge and displayed player ID instead of username. Fixed by:

  - Merging user data across ticks instead of replacing, preserving player info
  - Adding `badge?: Badge` to the users type throughout the codebase
  - Adding `refreshForeignCreepBadges()` to update creep visuals when badge data arrives

## 0.3.1

### Patch Changes

- 90ad28c: Batch terrain stroke/fill into a single call per terrain type to fix rendering artifacts on Firefox Mobile.
- 8e6e369: Enable antialiasing and render badges and structure textures at device pixel ratio scale for crisp output on HiDPI/retina displays.

## 0.3.0

### Minor Changes

- 464f9c3: Mods now depend on `screeps-client` instead of bundling their own copy of the client bundle.

  `screeps-client` ships three build variants under its published `dist/`:

  - `dist/standalone/` — `base=/`, no embedded flag (used for plain hosting)
  - `dist/embedded/` — `base=/client/`, embedded mode (used by `screepsmod-client-new`)
  - `dist/xxscreeps-mod/` — `base=/`, embedded + xxscreeps mode (used by `xxscreeps-mod-client`)

  `screepsmod-client-new` and `xxscreeps-mod-client` resolve the appropriate variant from the installed `screeps-client` package at runtime — they no longer carry their own `dist/` directory or build step. This removes the duplicate copy-into-mod step and makes the version coupling explicit.

### Patch Changes

- e761c02: Add `status` field to `MapStatsRoomData` so consumers can detect out-of-borders and restricted rooms. The client gains a "Show unclaimable rooms" toggle that highlights corridors, sector centres, owned rooms, and restricted areas on the world map.
- 421b330: Guest sessions are read-only: hide the View/Flag/Build mode switch (and its `2` / `3` keyboard shortcuts) when connected as guest. Snap the room view mode back to `view` whenever a guest session starts.
- bb05c68: In dev mode, default the login form's server URL to `window.location.origin` instead of a hard-coded `http://localhost:21025`. This makes the Vite proxy (`/api`, `/socket` → `VITE_PROXY_TARGET`) the default path for local development, regardless of which port Vite picks.
- 3043eac: Room rendering polish:

  - Terrain tweaks: darker wall/swamp fills + bolder borders for stronger silhouettes
  - Sources pulse gently from gold to near-white, in addition to the existing energy-driven size animation
  - Controllers in unowned rooms get a brighter octagon outline and a neutral center indicator so they remain legible without a badge
  - Minerals render as a colored disc + bold letter glyph (canonical Screeps palette: H/O/U/L/K/Z/X)
  - Tombstones rendered as a dome silhouette with an X glyph, tinted green (own) or red (foreign)
  - Ruins rendered as a broken-ring silhouette with an X glyph, same green/red ownership tinting

## 0.2.1

### Patch Changes

- d0af12a: Lazy-load the code editor and map viewer panels, and split `pixi.js` and CodeMirror into dedicated vendor chunks. Reduces the initial download by ~36% (319 kB → 204 kB gzipped) and fully defers CodeMirror until the code panel is opened. The mod packages re-ship the new client bundle.
