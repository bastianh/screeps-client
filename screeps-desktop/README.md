# screeps-desktop

Standalone [Tauri v2](https://tauri.app) desktop wrapper for `screeps-client`. It
bundles the existing `screeps-client` web build into a native shell so the client can
run without a browser tab and without being served by a Screeps server.

## How it works

- The frontend is the existing standalone web build (`screeps-client/dist/standalone`).
  No separate UI is maintained here.
- Cross-origin networking: the client routes `fetch` through the **Tauri HTTP plugin**
  (`tauri-plugin-http`, requests run in Rust), bypassing WebView CORS so it can talk to
  official and arbitrary private servers. This is wired up in
  `screeps-client/src/utils/tauri.ts` + `src/index.tsx`, guarded by `isTauri()` so the
  browser build is unaffected.
- WebSocket stays native in the WebView (Screeps WS auth is token-based, not CORS-bound).
- Login (server URL + token) persists across restarts: under Tauri the auth keys are
  stored in `localStorage` (persistent in the app data dir) instead of `sessionStorage`
  (see `screeps-client/src/utils/storage.ts`).
- Credentials (token, server password, saved-login flag) are stored in the OS-native
  credential store via the `keyring` crate — Keychain on macOS, Credential Manager on
  Windows, Secret Service on Linux — exposed through the `keyring_set` / `keyring_get` /
  `keyring_delete` Tauri commands (`src-tauri/src/lib.rs`) and wrapped by
  `screeps-client/src/utils/keychain.ts`.
- The login screen keeps a list of previously used servers with optional saved
  credentials, so switching between official and private servers doesn't require
  re-entering the URL or logging in again each time.

## Prerequisites

- Rust toolchain (`cargo`) — https://www.rust-lang.org/tools/install
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` (see
  `.github/workflows/desktop-release.yml` for the exact apt packages used in CI)
- Windows: no extra system packages beyond the Rust MSVC toolchain

## Commands

Run from the repo root (these build `screeps-connectivity` first):

```sh
pnpm desktop          # dev: starts the Vite dev server + native window (HMR)
pnpm desktop:build    # production: builds the client + produces a native bundle for the host OS
```

Or directly in this package (assumes `screeps-connectivity` is already built):

```sh
pnpm --filter screeps-desktop dev
pnpm --filter screeps-desktop build
```

Build output: `screeps-desktop/src-tauri/target/release/bundle/` (`.app`/`.dmg` on
macOS, `.deb`/`.rpm`/`.AppImage` on Linux, `.msi`/`.exe` on Windows).

## Releasing

`.github/workflows/desktop-release.yml` is a manually-triggered (`workflow_dispatch`)
GitHub Actions workflow that builds signed(-ish) bundles for macOS (arm64 + x86_64),
Linux, and Windows in parallel, then publishes them as a draft GitHub Release tagged
`desktop-v<version>`. Trigger it from the Actions tab with the version number to
release; review and publish the draft release once the artifacts look right.

## Regenerating icons

```sh
pnpm --filter screeps-desktop exec tauri icon path/to/1024x1024.png
```

## Notes / known limitations

- macOS builds are ad-hoc signed (`signingIdentity: "-"` in `tauri.conf.json`), not
  notarized — Gatekeeper still requires right-click → Open on first launch. Proper
  Developer ID signing/notarization is future work.
- Devtools are enabled in release builds (`tauri` feature `devtools`) to make
  on-device debugging possible before the app has a proper crash/log reporting story.
- The HTTP plugin capability scope (`src-tauri/capabilities/default.json`) allows
  `http://*` and `https://*` (any host/port) so private servers on either scheme work.
