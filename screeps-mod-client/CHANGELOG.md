# screepsmod-client-new

## 0.2.5

### Patch Changes

- 046b25c: Add room history mode: replay historical ticks via the screepsmod-history API with playback controls (step, play/pause, speed) in the sidebar and a timeline slider on the room canvas. Fix SPA catch-all in screeps-mod-client shadowing backend routes such as `/room-history` when the client is mounted at `/`.
- Updated dependencies [010e8c4]
- Updated dependencies [5e8af08]
- Updated dependencies [cf6c9d7]
- Updated dependencies [7a20f8c]
- Updated dependencies [046b25c]
  - screeps-client@0.3.4

## 0.2.4

### Patch Changes

- d372d45: Update the required `screeps-client` version for both mod packages after the next client release.

## 0.2.3

### Patch Changes

- 64fcb46: Show the current client version in Settings and expose the embedded wrapper version for screeps-mod and xxscreeps deployments.
- Updated dependencies [64fcb46]
- Updated dependencies [f31f69e]
- Updated dependencies [d86e8df]
- Updated dependencies [b14a86d]
  - screeps-client@0.3.2

## 0.2.2

### Patch Changes

- 464f9c3: Mods now depend on `screeps-client` instead of bundling their own copy of the client bundle.

  `screeps-client` ships three build variants under its published `dist/`:

  - `dist/standalone/` — `base=/`, no embedded flag (used for plain hosting)
  - `dist/embedded/` — `base=/client/`, embedded mode (used by `screepsmod-client-new`)
  - `dist/xxscreeps-mod/` — `base=/`, embedded + xxscreeps mode (used by `xxscreeps-mod-client`)

  `screepsmod-client-new` and `xxscreeps-mod-client` resolve the appropriate variant from the installed `screeps-client` package at runtime — they no longer carry their own `dist/` directory or build step. This removes the duplicate copy-into-mod step and makes the version coupling explicit.

- Updated dependencies [e761c02]
- Updated dependencies [421b330]
- Updated dependencies [bb05c68]
- Updated dependencies [464f9c3]
- Updated dependencies [3043eac]
  - screeps-client@0.3.0

## 0.2.1

### Patch Changes

- d0af12a: Lazy-load the code editor and map viewer panels, and split `pixi.js` and CodeMirror into dedicated vendor chunks. Reduces the initial download by ~36% (319 kB → 204 kB gzipped) and fully defers CodeMirror until the code panel is opened. The mod packages re-ship the new client bundle.
- 98bea3e: Mark `express` (in `screepsmod-client-new`) and `xxscreeps` (in `xxscreeps-mod-client`) as optional peer dependencies, and disable pnpm's `auto-install-peers` for the workspace. Prevents the legacy `xxscreeps@0.1.0` dep tree (jquery, angular, lodash, koa, webpack, …) from being installed during development, which removes ~30 transitive vulnerabilities from the lockfile. The mods still require their host frameworks at runtime — that requirement is unchanged.
