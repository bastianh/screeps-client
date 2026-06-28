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

## Prerequisites

- Rust toolchain (`cargo`) — https://www.rust-lang.org/tools/install
- macOS: Xcode Command Line Tools (`xcode-select --install`)

## Commands

Run from the repo root (these build `screeps-connectivity` first):

```sh
pnpm desktop          # dev: starts the Vite dev server + native window (HMR)
pnpm desktop:build    # production: builds the client + produces a macOS .app/.dmg
```

Or directly in this package (assumes `screeps-connectivity` is already built):

```sh
pnpm --filter screeps-desktop dev
pnpm --filter screeps-desktop build
```

Build output: `screeps-desktop/src-tauri/target/release/bundle/`.

## Regenerating icons

```sh
pnpm --filter screeps-desktop exec tauri icon path/to/1024x1024.png
```

## Notes / future work

- macOS only for now. Windows/Linux + CI signing/notarization are future work.
- The HTTP plugin capability scope (`src-tauri/capabilities/default.json`) allows
  `http://**` and `https://**` so private servers on either scheme work.
