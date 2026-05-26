---
title: client
type: note
permalink: screeps-client/claude/client
---

# screeps-client — Architecture

SolidJS + PixiJS browser frontend. Dev server: `pnpm dev` (from `screeps-client/`).

Path alias `~/` → `screeps-client/src/`. Use it for all intra-package imports.

`screeps-connectivity` is a workspace dep with a `"development"` export condition pointing to its TS source — no need to build the library before `pnpm dev`. For production builds, build connectivity first (`pnpm build` at root does this automatically).

## Source structure

```
src/
├── index.tsx                    # Entry: renders <App> into #root
├── app/
│   ├── App.tsx                  # Root: auto-connects on mount, switches LoginForm ↔ Dashboard
│   └── Dashboard.tsx            # Main layout: header, canvas, console, sidebar + draggable splitters
├── components/
│   ├── Sidebar/                 # index.tsx + BuildPanel, FlagForm, RoomInfoBox
│   ├── CodePanel.tsx            # CodeMirror editor panel
│   ├── ConnectionStatus.tsx     # Color-coded status chip
│   ├── ConsolePanel.tsx         # Log + Console tabs, auto-scroll, input form
│   ├── LoginForm.tsx            # Auth: password/token mode, server URL, registration
│   ├── MapInfoPanel.tsx         # Map-level info overlay
│   ├── MapViewer.tsx            # World map PixiJS view
│   ├── RoomInfoPanel.tsx        # Selected room info
│   ├── RoomNavigator.tsx        # Room name + shard input with Load button
│   ├── RoomViewer.tsx           # Ties RoomRenderer to store subscriptions
│   ├── SelectionList.tsx        # Object selection list
│   ├── SettingsPanel.tsx        # User settings UI
│   ├── StatsBar.tsx             # Live CPU/memory stats via UserStore
│   └── ToastContainer.tsx       # Toast display
├── renderer/
│   ├── RoomRenderer.ts          # PixiJS Application: drag/zoom world container, nav zones
│   ├── MapRenderer.ts           # World map renderer
│   ├── TerrainLayer.ts          # Plain/Wall/Swamp tiles
│   ├── ObjectLayer.ts           # Creeps, structures; smooth movement via ticker
│   ├── VisualLayer.ts           # Screeps visual primitives
│   ├── ActionAnimationLayer.ts  # Attack/heal/rangedAttack animations
│   ├── HoverHighlightLayer.ts   # Hover highlight overlay
│   ├── BadgeTextureCache.ts     # Player badge texture cache
│   ├── StructureTextureCache.ts # Structure texture cache
│   ├── terrainCache.ts          # Terrain tile texture cache
│   ├── terrain.worker.ts        # Terrain decode web worker
│   └── colors.ts                # Shared color constants
├── stores/
│   ├── clientStore.ts           # Signals (client, status, error) + connect/disconnect/tryAutoConnect
│   ├── roomViewStore.tsx        # Active room view state (name, shard, viewport)
│   ├── roomDataStore.ts         # Room objects + terrain reactive cache
│   ├── selectionStore.ts        # Selected game object
│   ├── settingsStore.ts         # Persisted user settings
│   ├── consoleStore.ts          # Console log history
│   ├── mapOverlayStore.ts       # World map overlay mode
│   └── toastStore.ts            # Toast notification queue
├── types/
│   └── client.ts                # ClientState, RoomViewState
└── utils/
    ├── roomName.ts              # Parse/format room names (W7N7 ↔ {x,y})
    ├── dom.ts                   # DOM helpers
    ├── embedded.ts              # Embedded/mod mode detection
    ├── log.ts                   # Logger instance
    ├── storage.ts               # localStorage key constants
    └── useRoomNavigationKeys.ts # Keyboard shortcut hook
```

## State management

`clientStore.ts` holds SolidJS signals (`client`, `status`, `error`) and functions (`connect`, `disconnect`, `tryAutoConnect`). Credentials persisted to `localStorage` for auto-reconnect. `App.tsx` calls `tryAutoConnect()` on mount.

`RoomViewer.tsx` subscribes to `RoomStore` and `UserStore`, creates `TerrainLayer` and `ObjectLayer`, hands them to `RoomRenderer`.

`RoomRenderer.ts` wraps a PixiJS `Application` in a `world` container with pointer-drag panning, wheel zoom, navigation zones (edge-scroll), and a view-reset method.