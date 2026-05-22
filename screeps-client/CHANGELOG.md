# screeps-client

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
