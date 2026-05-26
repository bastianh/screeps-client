---
title: screeps-client Frontend
type: note
permalink: screeps-client/project/screeps-client-frontend
tags:
- frontend
- solidjs
- pixijs
- vite
- browser
---

# screeps-client Frontend

The browser SPA that renders the Screeps game world. Built with SolidJS (reactive UI) and PixiJS v8 (WebGL room/map rendering). Bundled by Vite. Version 0.3.4. Published to npm — the `dist/` directory is what the mod packages embed.

Three separate build outputs:
- `dist/` — standalone build (served directly, base path `/`)
- `dist/embedded/` — embedded build for `screepsmod-client-new` (base path `/client/`)
- `dist/xxscreeps-mod/` — embedded build for `xxscreeps-mod-client` (base path `/`)

The `screeps-connectivity` package is referenced via a `"development"` export condition during dev, pointing straight at the TS source. No library prebuild needed for `pnpm dev`.

## Source structure

```
src/
├── index.tsx                  — Entry: renders <App> into #root
├── app/
│   ├── App.tsx                — Root: auto-connects on mount, switches LoginForm ↔ Dashboard
│   └── Dashboard.tsx          — Main layout: header, canvas, console, sidebar + draggable splitters
├── components/                — UI panels (see below)
├── renderer/                  — PixiJS layers
├── stores/                    — SolidJS signals + connectivity wiring
├── types/client.ts            — ClientState, RoomViewState type aliases
└── utils/                     — roomName parsing, dom helpers, embedded detection, keyboard hook
```

## Key components

| File | Purpose |
|---|---|
| `LoginForm.tsx` | Auth UI: password/token/guest modes, server URL, registration |
| `Dashboard.tsx` | Main layout with draggable splitters |
| `RoomViewer.tsx` | Wires RoomStore + UserStore subscriptions into renderer |
| `MapViewer.tsx` | World map PixiJS view |
| `ConsolePanel.tsx` | Log + Console tabs, auto-scroll, input form |
| `RoomInfoPanel.tsx` | Selected room info, creep-label and visual toggles |
| `Sidebar/` | BuildPanel, FlagForm, RoomInfoBox |
| `CodePanel.tsx` | CodeMirror 6 JS editor |
| `StatsBar.tsx` | Live CPU/memory stats via UserStore |

## Renderer layers (PixiJS)

`RoomRenderer` wraps a PixiJS `Application` in a `world` container and manages:
- Pointer-drag panning and pinch-to-zoom (with rubber-band resistance and spring-back animation)
- Mouse-wheel zoom around cursor, clamped to [minScale, 5]
- Edge-scroll navigation zones (N/S/E/W arrows at room boundary)
- Tile hit-testing via `screenToTile()`, click and hover callbacks
- TILE_SIZE = 12px, ROOM_SIZE = 50 × 12 = 600px world units

Sub-layers (all children of `world` Container):
- `TerrainLayer` — plain/wall/swamp tiles from cached Uint8Array terrain
- `ObjectLayer` — creeps + structures; smooth movement per ticker tick
- `VisualLayer` — Screeps visual primitives (lines, circles, text)
- `ActionAnimationLayer` — attack/heal/rangedAttack animations
- `HoverHighlightLayer` — tile highlight under cursor + selection highlight
- `BadgeTextureCache` / `StructureTextureCache` — texture caching for SVG badges and structure sprites

## State management

All SolidJS signals are module-level singletons (no context providers).

| Store file | Signals |
|---|---|
| `clientStore.ts` | `client`, `status`, `error`, `userInfo`, `serverVersion`, `gameTime`, `tickDuration`, `isGuest`, `worldBounds`, `userFlags`, `worldStatus` |
| `roomViewStore.tsx` | Active room name, shard, viewport |
| `roomDataStore.ts` | Reactive room objects + terrain |
| `selectionStore.ts` | Selected game object |
| `settingsStore.ts` | Persisted user settings (localStorage) |
| `consoleStore.ts` | Console log history |
| `mapOverlayStore.ts` | World map overlay mode |
| `toastStore.ts` | Toast notification queue |

`clientStore.connect()` instantiates `ScreepsClient`, wires store event listeners to SolidJS signals, calls `ScreepsClient.connect()`, then subscribes the user stream. Credentials (url, token, serverPassword) are persisted to `sessionStorage` for auto-reconnect across page refreshes.

## Embedded mode detection

`utils/embedded.ts` checks `window.__SCREEPS_CLIENT_EMBEDDED__` injected by the mod's server at HTML delivery time. In embedded mode, the server URL is inferred from `window.location` rather than the login form.

## Observations
- [architecture] SolidJS signals are module-level singletons, not context-provided — easy to import anywhere but means one client instance at a time
- [design] PixiJS RoomRenderer uses requestAnimationFrame spring-back animation and ResizeObserver for responsive canvas sizing
- [design] Tile size is 12px; room is always 50×50 tiles = 600px world units
- [convention] All intra-package imports use `~/` alias pointing to `src/`
- [build] Three separate Vite outputs: standalone, embedded (/client/), xxscreeps-embedded (/)
- [version] 0.3.4

## Relations
- part_of [[Screeps Client Monorepo Overview]]
- depends_on [[screeps-connectivity Library]]
- embedded_by [[screepsmod-client-new Server Mod]]
- embedded_by [[xxscreeps-mod-client Mod]]
