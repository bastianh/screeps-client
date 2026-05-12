# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Monorepo with two active packages and a `reference/` directory containing third-party source for reference only (do not edit):

- `screeps-connectivity/` — core TypeScript library: HTTP, WebSocket, stores, cache, storage
- `screeps-client/` — SolidJS + PixiJS browser frontend that consumes `screeps-connectivity`
- `docs/superpowers/` — design specs and plans

## Commands

### screeps-connectivity (run from `screeps-connectivity/`)

```sh
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm test            # Vitest, single run
npm run test:watch  # Vitest watch mode
npm run lint        # ESLint src + tests
```

Run a single test file:
```sh
npx vitest run tests/socket/SocketClient.test.ts
```

### screeps-client (run from `screeps-client/`)

```sh
npm run dev     # Vite dev server
npm run build   # tsc + vite build
npm run lint    # ESLint src
```

The Vite config aliases `screeps-connectivity` directly to `screeps-connectivity/src/index.ts`, so the library does **not** need to be built before running the dev server.

## Architecture

### screeps-connectivity

Five layers, each with a single responsibility:

```
ScreepsClient          — facade, wires everything together
  ├─ HttpClient        — fetch wrapper, auth headers, rate limiting, gzip decompression
  └─ SocketClient      — WebSocket lifecycle, reconnect (exponential backoff), sub ref-counting
       └─ MessageParser — plain-text commands and JSON-array messages, gzip via DecompressionStream
DataStores             — RoomStore · UserStore · ServerStore (extend TypedStore → EventTarget)
Cache                  — two-tier: in-memory Map + optional StorageAdapter, namespaced by server hostname
StorageAdapter         — binary interface (Uint8Array); IndexedDBStorage · FileStorage · NullStorage
```

**ScreepsClient** is the only entry point consumers instantiate. `connect()` authenticates via the injected `AuthStrategy`, then opens the WebSocket. The `WebSocket` constructor can be injected for Node 18/20 compatibility.

**Auth strategies** (`TokenAuth`, `PasswordAuth`) implement `AuthStrategy.authenticate(http) → Promise<string>`. Adding a new strategy requires no changes to `HttpClient`.

**DataStores** each extend `TypedStore<EventMap>`, which extends `EventTarget`. Calling `store.on(type, handler)` returns a `Subscription` (`{ dispose() }`). `SubscriptionGroup` composes multiple subscriptions for batch teardown — maps directly to `onCleanup` (SolidJS) or `onDestroy` (Svelte).

**Room objects**: the first WebSocket message for a room is the full state; subsequent messages are diffs. `RoomStore` merges diffs internally so consumers always see complete state.

**Terrain** is stored as `Uint8Array(2500)` — 1 byte per tile (values 0–3) — both in memory and as raw binary in persistent storage. No JSON/base64 overhead.

**Cache namespacing** is derived from the server URL hostname, preventing collisions when connecting to multiple servers.

### screeps-client

SolidJS app with PixiJS for room rendering. State lives in `src/stores/clientStore.ts` as SolidJS signals. The `clientStore` holds the active `ScreepsClient` instance and connection status. `App.tsx` switches between `<LoginForm>` and `<Dashboard>` based on connection state.

`RoomRenderer` (`src/renderer/`) manages a PixiJS `Application` with a draggable/zoomable `world` container. `TerrainLayer` and `ObjectLayer` are separate PixiJS layers added to `world`.

## Coding Conventions

- TypeScript strict mode, ESM, 2-space indentation, no semicolons
- Named exports throughout; explicit `.js` extensions in TypeScript import specifiers (e.g., `import { Foo } from './Foo.js'`)
- `PascalCase` for classes and files, `camelCase` for functions and variables
- Zero production dependencies in `screeps-connectivity` — use native platform APIs only
- `screeps-connectivity/dist/` is generated — never hand-edit it
