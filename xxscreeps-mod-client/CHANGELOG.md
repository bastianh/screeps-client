# xxscreeps-mod-client

## 0.3.3

### Patch Changes

- 76902c0: Bundle the updated screeps-client build (non-public saying visibility fix).
- Updated dependencies [661a53f]
- Updated dependencies [96de46b]
- Updated dependencies [9bc39f8]
- Updated dependencies [76902c0]
  - screeps-client@0.14.2

## 0.3.2

### Patch Changes

- 6168001: Fix 404 on reload of `/map/<shard>` SPA routes. `/map/` was in the default
  exclude list, so when the client is mounted at root the mod handed those paths
  straight to xxscreeps (which has no `/map/` HTTP route) instead of serving the
  SPA. Removed `/map/` from `DEFAULT_EXCLUDES`; the existing await-next()-then-404
  fallback still leaves any real server route untouched.

## 0.3.1

### Patch Changes

- 23ed626: Update the required `screeps-client` version for both mod packages after the next client release.
- Updated dependencies [23ed626]
- Updated dependencies [94a6658]
- Updated dependencies [0296bdf]
- Updated dependencies [46b5e2d]
  - screeps-client@0.14.1

## 0.3.0

### Minor Changes

- b26940a: xxscreeps-mod-client now publishes an `xxscreeps-mod-client` server feature at `/api/version` reflecting `.screepsrc.yaml`'s `backend.allowGuestAccess`, `backend.allowEmailRegistration`, and `backend.steamApiKey`. screeps-client reads this via the new `getXxscreepsModClientFeature` helper (screeps-connectivity) to show or hide the Guest, "Create account", and "Login with Steam" options to match what the server actually allows, instead of guessing.

### Patch Changes

- 594073a: Update the required `screeps-client` version for both mod packages after the next client release.
- Updated dependencies [8fd1a08]
- Updated dependencies [3ca699d]
- Updated dependencies [27b092e]
- Updated dependencies [594073a]
- Updated dependencies [15d0c1f]
- Updated dependencies [b26940a]
  - screeps-client@0.14.0

## 0.2.19

### Patch Changes

- cc7f5be: Update the required `screeps-client` version for both mod packages after the next client release.
- Updated dependencies [cc7f5be]
  - screeps-client@0.13.1

## 0.2.18

### Patch Changes

- Updated dependencies [1539f52]
- Updated dependencies [e5b16a1]
- Updated dependencies [de39cf0]
- Updated dependencies [abe0e3d]
- Updated dependencies [4b8f9d9]
  - screeps-client@0.13.0

## 0.2.17

### Patch Changes

- eaa037e: Default mount path is now `/` instead of `/client`. The shipped bundle references some assets (e.g. the sprite atlas under `themes/`) at the server root, so mounting under `/client` left those URLs 404ing. Mounting at `/` makes the client work out of the box without setting `SCREEPS_MOD_CLIENT_MOUNT_PATH`. The `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` default now also follows the documented behavior (redirect only when the mount path is not `/`).
- Updated dependencies [e73c85f]
  - screeps-client@0.12.2

## 0.2.16

### Patch Changes

- db24504: Update to screeps-client 0.12.1 (includes screeps-connectivity 0.8.1 world-bounds fix).
- Updated dependencies [db24504]
  - screeps-client@0.12.1

## 0.2.15

### Patch Changes

- Updated dependencies [fb4ab0a]
- Updated dependencies [6d383dc]
- Updated dependencies [620f551]
- Updated dependencies [e0dac0b]
- Updated dependencies [3c7b10f]
  - screeps-client@0.12.0

## 0.2.14

### Patch Changes

- Updated dependencies [97d6fdf]
- Updated dependencies [58ba2bc]
- Updated dependencies [2e21be5]
- Updated dependencies [69d132d]
- Updated dependencies [2e67d21]
  - screeps-client@0.11.0

## 0.2.13

### Patch Changes

- Updated dependencies [cb2129e]
  - screeps-client@0.10.0

## 0.2.12

### Patch Changes

- Updated dependencies [e020835]
- Updated dependencies [8e12def]
- Updated dependencies [71ce50f]
- Updated dependencies [70c7dfb]
- Updated dependencies [dcc67d2]
- Updated dependencies [0e72b67]
- Updated dependencies [f525f2b]
- Updated dependencies [d4dbba3]
  - screeps-client@0.9.0

## 0.2.11

### Patch Changes

- Updated dependencies [a40445a]
  - screeps-client@0.8.0

## 0.2.10

### Patch Changes

- 36c5b73: Send explicit `Cache-Control` headers for the embedded client's static assets.
  Content-hashed files under `_client/` are served `immutable` (cacheable for a
  year); everything else — `index.html`, `themes/`, and other non-hashed `public/`
  assets — is served `no-cache` so browsers revalidate and pick up updated files
  (e.g. the sprite atlas `test.json`) instead of serving a stale cached copy.
  Previously no cache headers were set, so browsers cached these stable-URL assets
  heuristically and could keep stale frames after a spritesheet update.
- Updated dependencies [6262ce2]
- Updated dependencies [c7cf4bf]
  - screeps-client@0.7.3

## 0.2.9

### Patch Changes

- 67dc748: patch bump for screeps-client dependency update
- Updated dependencies [cb3a324]
- Updated dependencies [9826156]
- Updated dependencies [67dc748]
- Updated dependencies [2685f44]
  - screeps-client@0.7.0

## 0.2.8

### Patch Changes

- 26b0511: Inject `<base href="<mountPath>/">` into served HTML so relative asset URLs resolve from the mount root rather than the current SPA route. Without this, reloading at a sub-path like `/room/E11N2` caused the browser to fetch scripts from `/room/_client/…` instead of `/_client/…`.
- Updated dependencies [d61f26f]
  - screeps-client@0.6.0

## 0.2.7

### Patch Changes

- Updated dependencies [f87b2a4]
- Updated dependencies [e018214]
- Updated dependencies [4e838c1]
- Updated dependencies [14a4f03]
- Updated dependencies [de4fd47]
  - screeps-client@0.5.0

## 0.2.6

### Patch Changes

- 973e831: Rename Vite assets output directory from `assets/` to `_client/` to avoid collision with the game server's `/assets/` endpoint. The directory name is overridable via the `VITE_ASSETS_DIR` environment variable.
- Updated dependencies [973e831]
  - screeps-client@0.4.1

## 0.2.5

### Patch Changes

- 05a01a9: Default mount path changed from `/` to `/client` to avoid interfering with xxscreeps game server routes. When mounted at `/` explicitly, known server paths (`/api/`, `/socket`, `/backend/`, `/auth/`, `/assets/`, `/map/`) are now skipped via a configurable `SCREEPS_MOD_CLIENT_EXCLUDE` env var.
- Updated dependencies [1f571fb]
- Updated dependencies [31e9570]
- Updated dependencies [9c24c2f]
  - screeps-client@0.4.0

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
