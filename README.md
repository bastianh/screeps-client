# screeps-client

A browser-based client for [Screeps](https://screeps.com) — a real-time strategy game where you program your units in JavaScript. This monorepo contains a reusable connectivity library and a SolidJS + PixiJS frontend.

## Packages

| Package | Description |
|---|---|
| `screeps-connectivity/` | Core TypeScript library — HTTP API, WebSocket, data stores, caching, storage |
| `screeps-client/` | SolidJS + PixiJS browser app that consumes `screeps-connectivity` |
| `screeps-mod-client/` | Screeps server mod (`screepsmod-client-new`) that serves the embedded client at `/client` |
| `xxscreeps-mod-client/` | xxscreeps mod that serves and wires up the embedded client |

## Features

- Connect to any Screeps server (official or private) via password or API token
- Live room visualization: terrain tiles and room objects rendered with PixiJS
- Draggable, zoomable room viewport with edge-scroll navigation zones
- Live CPU and memory stats
- In-game console: view log output and send console commands
- Persistent sessions — reconnects automatically on page reload using stored token
- Two-tier terrain cache: in-memory + IndexedDB (no repeated API calls)

## Getting Started

### Prerequisites

- Node.js 18 or later
- pnpm 9 or later

### Install dependencies

```sh
pnpm install
```

### Run the dev server

```sh
pnpm dev
```

The Vite dev server resolves `screeps-connectivity` directly from `src/` — no build step needed for the library.

Open [http://localhost:5173](http://localhost:5173) and enter your Screeps server URL and credentials.

### Build for production

```sh
pnpm build
# Output: screeps-client/dist/standalone/
```

`screeps-client` ships three build variants under its `dist/`, one per consumer:

| Variant | Script | `base` | Used by |
|---|---|---|---|
| `dist/standalone/` | `pnpm build` | `/` | Plain static hosting |
| `dist/embedded/` | `pnpm build:embedded` | `/client/` | `screepsmod-client-new` |
| `dist/xxscreeps-mod/` | `pnpm build:embedded:xxscreeps` | `/` | `xxscreeps-mod-client` |

`pnpm --filter screeps-client build:all` builds all three. The release pipeline does this automatically before publishing — the two mod packages depend on `screeps-client` and resolve the right variant from its `dist/` at runtime, so they have no separate build step.

## Development

### screeps-connectivity

```sh
cd screeps-connectivity

npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm test            # Vitest, single run
npm run test:watch  # Vitest watch mode
npm run lint        # ESLint
```

### screeps-client

```sh
cd screeps-client

npm run dev          # Vite dev server (hot reload)
npm run build        # tsc + vite build → dist/standalone/
npm run build:all    # build all three variants (standalone + embedded + xxscreeps-mod)
npm run lint         # ESLint
```

## Architecture

### screeps-connectivity

A zero-production-dependency TypeScript library built on native platform APIs (fetch, WebSocket, IndexedDB, DecompressionStream).

```
ScreepsClient          — single entry point, wires all layers together
  ├─ HttpClient        — fetch wrapper, auth, rate limiting, gzip decompression
  │    └─ endpoints/   — auth · game · user · leaderboard · experimental
  └─ SocketClient      — WebSocket lifecycle, exponential-backoff reconnect, subscription ref-counting
       └─ MessageParser — plain-text commands + JSON-array messages, gz: decompression
DataStores             — RoomStore · UserStore · ServerStore (typed EventTarget)
Cache                  — in-memory Map + optional StorageAdapter, namespaced per server
StorageAdapter         — Uint8Array interface: IndexedDBStorage · FileStorage · NullStorage
```

**Usage example:**

```ts
import { ScreepsClient, PasswordAuth, IndexedDBStorage } from 'screeps-connectivity'

const client = new ScreepsClient({
  url: 'https://screeps.com',
  auth: new PasswordAuth({ email: 'you@example.com', password: 'secret' }),
  storage: new IndexedDBStorage('my-app'),
})

await client.connect()

// Subscribe to room updates
const sub = client.stores.room.subscribe('W7N7', 'shard3')
client.stores.room.on('room:objects', ({ room, objects }) => {
  console.log(room, objects)
})

// Clean up
sub.dispose()
client.disconnect()
```

**Terrain** is stored as `Uint8Array(2500)` (1 byte per tile, values 0–3), persisted as raw binary — no JSON overhead.

**Room diffs**: the first WebSocket message is the full room state; subsequent messages are diffs. `RoomStore` merges them automatically.

**Subscriptions** return `{ dispose() }`. Use `SubscriptionGroup` to batch-dispose multiple subscriptions (maps cleanly to SolidJS `onCleanup`).

### screeps-client

A SolidJS application. State lives in `src/stores/clientStore.ts` as reactive signals. The root `App` component auto-reconnects on mount from `localStorage` and switches between `<LoginForm>` and `<Dashboard>`.

`Dashboard` provides the main layout:
- **Header**: connection status, live stats, room navigator, logout
- **Main**: PixiJS room canvas (`RoomViewer`)
- **Bottom**: console panel with Log / Console tabs
- **Right**: collapsible sidebar

`RoomRenderer` wraps a PixiJS `Application` in a `world` container that supports mouse-drag panning, scroll-wheel zoom, and edge-scroll navigation zones.

## Repository Layout

```
screeps-client/          # monorepo root
├── screeps-connectivity/
│   ├── src/
│   │   ├── ScreepsClient.ts
│   │   ├── http/          # HttpClient, auth strategies, API endpoints
│   │   ├── socket/        # SocketClient, MessageParser
│   │   ├── stores/        # RoomStore, UserStore, ServerStore, TypedStore
│   │   ├── cache/         # Cache
│   │   ├── storage/       # StorageAdapter implementations
│   │   ├── subscription/  # SubscriptionGroup
│   │   └── types/         # API + game types
│   └── tests/
├── screeps-client/
│   └── src/
│       ├── app/           # App.tsx, Dashboard.tsx
│       ├── components/    # UI components
│       ├── renderer/      # PixiJS layers (RoomRenderer, TerrainLayer, ObjectLayer)
│       ├── stores/        # clientStore (SolidJS signals)
│       ├── types/         # Client-side type definitions
│       └── utils/         # roomName parser/formatter
└── docs/                  # API reference and design specs
```

## Releases

Versioning and npm publishing are driven by [Changesets](https://github.com/changesets/changesets).

When your change affects a published package, add a changeset alongside the code change:

```sh
pnpm changeset
```

The CLI asks which packages changed and at what semver level, then writes a markdown file under `.changeset/`. Commit it with your PR.

On push to `main`, `.github/workflows/release.yml` does one of:

- **Unreleased changesets present** — opens (or updates) a *"chore: version packages"* PR that bumps `package.json` versions and updates `CHANGELOG.md`. Merging that PR triggers the publish run.
- **No pending changesets** — builds `screeps-connectivity` and all three `screeps-client` variants, then runs `changeset publish`, which only pushes versions that aren't already on npm.

CI requires the `NPM_TOKEN` repository secret, and Settings → Actions → General → *Workflow permissions* must allow Actions to create pull requests.

See `.changeset/README.md` for contributor-facing details.

## License

[ISC](./LICENSE) © Bastian Hoyer
