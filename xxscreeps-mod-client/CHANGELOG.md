# xxscreeps-mod-client

## 0.3.16

### Patch Changes

- acfa85b: Rebuild the embedded client so the mods ship the current `screeps-client` fixes.
- Updated dependencies [acfa85b]
- Updated dependencies [55194c5]
- Updated dependencies [0867a1b]
  - screeps-client@0.24.3

## 0.3.15

### Patch Changes

- 4016760: Update the embedded client (RoomVisual text and shape style defaults now match the official client; map visual text now matches the reference client's opacity, stroke and background-box behaviour; room decoration landscapes now tile, stretch and outline at the official geometry).
- Updated dependencies [3d0aa73]
- Updated dependencies [677c063]
- Updated dependencies [f29d41a]
- Updated dependencies [526e00c]
- Updated dependencies [4016760]
- Updated dependencies [d63cb89]
- Updated dependencies [7ec6fc4]
  - screeps-client@0.24.1

## 0.3.14

### Patch Changes

- 01a3551: Update the embedded client (badge symbols granted by decorations appear in the badge editor; OAuth registration gains a "Disable email notifications" checkbox; WASM modules can be uploaded and managed in the code editor).
- Updated dependencies [01a3551]
- Updated dependencies [7d2e2f4]
- Updated dependencies [40f5076]
- Updated dependencies [e74c83c]
  - screeps-client@0.24.0

## 0.3.13

### Patch Changes

- 1accbd8: Update the required `screeps-client` version for both mod packages after the next client release.
  Adjust this summary if the release notes should say something more specific.
- Updated dependencies [1accbd8]
- Updated dependencies [0b62464]
- Updated dependencies [3d31ab2]
- Updated dependencies [ae911fa]
- Updated dependencies [3020fec]
  - screeps-client@0.23.0

## 0.3.12

### Patch Changes

- 35df8bd: Update the required `screeps-client` version for both mod packages after the next client release.
- Updated dependencies [0adbd5f]
- Updated dependencies [564ce4e]
- Updated dependencies [b510e92]
- Updated dependencies [b510e92]
- Updated dependencies [35df8bd]
- Updated dependencies [b6b228d]
  - screeps-client@0.22.0

## 0.3.11

### Patch Changes

- b6df4b5: Update the required `screeps-client` version for both mod packages after the next client release.
- Updated dependencies [ef5eba7]
- Updated dependencies [5253263]
- Updated dependencies [afb753d]
- Updated dependencies [127adca]
- Updated dependencies [66bf09f]
- Updated dependencies [b6df4b5]
- Updated dependencies [682f31e]
- Updated dependencies [66bf09f]
  - screeps-client@0.21.0

## 0.3.10

### Patch Changes

- Updated dependencies [764b871]
- Updated dependencies [be68680]
- Updated dependencies [552bb32]
- Updated dependencies [e33e5fc]
- Updated dependencies [278230a]
- Updated dependencies [0e8b382]
- Updated dependencies [975c619]
- Updated dependencies [4d4167f]
- Updated dependencies [5a0355a]
- Updated dependencies [5173461]
- Updated dependencies [268b592]
- Updated dependencies [4d4167f]
- Updated dependencies [465a257]
- Updated dependencies [1a9556f]
- Updated dependencies [6e815d6]
- Updated dependencies [4b3412e]
- Updated dependencies [ecdadcf]
- Updated dependencies [f31e5c8]
- Updated dependencies [c4d9b82]
- Updated dependencies [47b7b75]
  - screeps-client@0.20.0

## 0.3.9

### Patch Changes

- Updated dependencies [6f45a4b]
  - screeps-client@0.19.0

## 0.3.8

### Patch Changes

- f218429: Embedded clients are now configured from the first frame with no `/api/version` round-trip: both the xxscreeps mod and the classic server mod prefetch the version payload and inline it into the page (`window.__SCREEPS_BOOTSTRAP__`), and the client seeds it into both the pre-login UI and the connection. `ScreepsClient` gains an `initialVersion` option and `ServerStore` a `seedVersion()` method to support this.
- Updated dependencies [8e9f7ed]
- Updated dependencies [202bb3d]
- Updated dependencies [f218429]
- Updated dependencies [ddc2277]
- Updated dependencies [e678c10]
- Updated dependencies [114e4b1]
- Updated dependencies [3b2c531]
- Updated dependencies [7cc40b4]
  - screeps-client@0.18.0

## 0.3.7

### Patch Changes

- 76dfef2: Serve the client via a route allowlist instead of a backend-path blocklist. The mod now claims only the client's own SPA routes (`/user`, `/profile`, `/messages`, `/market`, `/room-overview`, `/map`, `/room`) plus real files in `dist/`, and hands every other path straight to xxscreeps. This drops the `SCREEPS_MOD_CLIENT_EXCLUDE` env var and the `await next()`-then-intercept-404 fallback, so new backend routes can never be swallowed into the SPA shell and unknown paths get a real 404. Mirrors the standalone `screeps-client-proxy` change.
- Updated dependencies [e83d9da]
- Updated dependencies [06a2c65]
- Updated dependencies [cafe90b]
- Updated dependencies [0abba53]
- Updated dependencies [3a68c21]
  - screeps-client@0.17.1

## 0.3.6

### Patch Changes

- 38b4198: Console improvements: the Log pane pause button now actually stops the feed (incoming messages are buffered while paused and flushed on resume, instead of just pausing the scroll), error lines are shown inline in arrival order at the bottom next to surrounding logs (previously every error was pinned above all log output), and a new regex filter button hides log/error lines that don't match the entered pattern.
- 8e9bbd7: Rebuild embedded client with the Custom UI editor.
- 64b08e0: Update the required `screeps-client` version for both mod packages after the next client release.
  Adjust this summary if the release notes should say something more specific.
- Updated dependencies [38b4198]
- Updated dependencies [8e9bbd7]
- Updated dependencies [a6cb0b4]
- Updated dependencies [64b08e0]
  - screeps-client@0.17.0

## 0.3.5

### Patch Changes

- eb6f864: Rebuild embedded client with the latest screeps-client changes.
- Updated dependencies [66f88f8]
- Updated dependencies [47c34f1]
- Updated dependencies [eb6f864]
- Updated dependencies [1b547e3]
  - screeps-client@0.16.0

## 0.3.4

### Patch Changes

- 851580d: Bundle the updated screeps-client build (User hub Messages route).
- Updated dependencies [5d46b8e]
- Updated dependencies [57a7e1d]
- Updated dependencies [7d5747c]
- Updated dependencies [d136a15]
- Updated dependencies [3b9b951]
- Updated dependencies [79bd3d0]
- Updated dependencies [851580d]
  - screeps-client@0.15.0

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
