# screeps-client

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
