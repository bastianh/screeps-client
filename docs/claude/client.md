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
│   └── Dashboard.tsx            # Main layout: header, canvas, console, sidebar + draggable splitters; URL routing
├── components/
│   ├── theme.ts                 # Central GitHub-dark palette tokens for the HTML UI
│   ├── Sidebar/                 # index.tsx + BuildPanel, FlagForm, DecoratePanel,
│   │                            #   DecorationPicker, RoomInfoBox, RoomDecorationsPanel,
│   │                            #   CustomUiPanel, CustomObjectActions, HistoryControlPanel
│   ├── inventory/               # Decoration inventory + editor: Inventory, DecorationDialog,
│   │                            #   DecorationProperties, PlacementFrame (shared drag frame),
│   │                            #   DecorationPositionEditor, positionEditor.ts (geometry),
│   │                            #   activation.ts, commit.ts (activate/deactivate), sorting.ts
│   ├── selection/               # Per-type detail views for the selection panel + registry.ts + shared.ts
│   ├── login/                   # shared.tsx: building blocks + capability probes for both login forms
│   ├── market/                  # Market pages (orders, history, resource views) + section theme
│   ├── power/                   # Power Creeps pages (list, detail, create) + section theme
│   ├── leaderboard/             # Leaderboard page (world/power ranking tables) + mode metadata,
│   │                            #   RankTiles.tsx: current-month rank tiles for Overview/Profile
│   ├── LoginForm.tsx            # Web login: password/token mode, server URL, registration, OAuth
│   ├── DesktopLoginForm.tsx     # Desktop/proxy login: server list + keychain-saved credentials
│   ├── OAuthUsernameForm.tsx    # "Pick a username" step after an OAuth provider signup
│   ├── CodePanel.tsx            # CodeMirror editor panel (branches, modules)
│   ├── CustomUiEditor.tsx       # Visual editor for the Custom UI config segment
│   ├── ConsolePanel.tsx         # Log + Console tabs, auto-scroll, input form
│   ├── SegmentsPanel.tsx        # Memory segments viewer/editor
│   ├── MemoryTree.tsx           # Memory path tree with watches
│   ├── MapViewer.tsx            # World map PixiJS view
│   ├── RoomViewer.tsx           # Ties RoomRenderer to store subscriptions
│   ├── SelectionList.tsx        # Selection panel list + item chrome (details live in selection/)
│   ├── MeterBar.tsx             # Shared label+fill meter (RCL/store/hits) + damage-graded HitsBar
│   ├── Overview.tsx / Profile.tsx / Messages.tsx  # Account pages
│   ├── StatsBar.tsx             # Live CPU/memory stats via UserStore
│   └── …                        # RoomNavigator, RoomInfoPanel, MapInfoPanel, SettingsPanel,
│                                #   BadgePickerModal, ToastContainer, ConnectionStatus, modals
├── data/                        # Static game data (resources, power creeps)
├── editor/                      # CodeMirror TS integration: tsserver worker, virtual libs, module graph
├── renderer/
│   ├── RoomRenderer.ts          # PixiJS Application: drag/zoom world container, nav zones
│   ├── MapRenderer.ts           # World map renderer (owner/mineral/alliance overlays, minimap tiles)
│   ├── TerrainLayer.ts          # Plain/Wall/Swamp tiles
│   ├── ObjectLayer.ts           # Object lifecycle: diffs, fill tweens, movement/animation ticker
│   ├── objects/                 # Per-object visual modules (creep, spawn, tower, …) +
│   │                            #   createObjectVisual dispatcher, shared helpers, types
│   ├── VisualLayer.ts           # Screeps visual primitives
│   ├── MapVisualLayer.ts        # Map visuals (RoomVisual on the world map)
│   ├── ActionAnimationLayer.ts  # Attack/heal/rangedAttack animations
│   ├── LightingLayer.ts         # Owned-structure lighting
│   ├── HoverHighlightLayer.ts   # Hover highlight overlay
│   ├── BadgeTextureCache.ts     # Player badge texture cache
│   ├── StructureTextureCache.ts # Structure texture cache
│   ├── AtlasCache.ts            # Spritesheet atlas cache
│   ├── terrainCache.ts          # Terrain tile texture cache
│   ├── terrain.worker.ts        # Terrain decode web worker
│   ├── themes/                  # Sprite theme specs (atlas frames per structure)
│   └── colors.ts                # Renderer color constants (PixiJS palette)
├── stores/
│   ├── clientStore.ts           # Signals (client, status, error) + connect/disconnect/tryAutoConnect
│   ├── roomViewStore.tsx        # Room interaction mode (view | flag | build | decorate) + drafts
│   ├── roomDataStore.ts         # Room objects + terrain reactive cache
│   ├── decorationEditStore.ts   # Draft of the decoration being edited in the room view
│   ├── routeStore.ts            # URL ↔ view routing state
│   ├── selectionStore.ts        # Selected game objects
│   ├── settingsStore.ts         # Persisted user settings
│   ├── consoleStore.ts          # Console log history + panel visibility
│   ├── memoryStore.ts           # Memory tree watches
│   ├── customUiStore.ts         # Custom UI panels driven by a memory segment
│   ├── historyStore.ts + HistoryPlayer.ts  # Room history playback
│   ├── mapOverlayStore.ts       # World map overlay mode (owner | mineral | alliance | none)
│   ├── allianceStore.ts        # LOAN alliance roster (lazy fetch + cache, derived colours)
│   ├── capabilities.ts          # Server capability flags
│   └── toastStore.ts            # Toast notification queue
├── types/
│   └── client.ts                # ClientState, RoomViewState
└── utils/
    ├── roomName.ts              # Parse/format room names (W7N7 ↔ {x,y})
    ├── formatNumber.ts          # Shared number formatting (formatLargeNumber, fmtAmount, fmtPrice)
    ├── gameConstants.ts / gameRoutes.ts / levels.ts / ownedRooms.ts / formatStat.ts
    ├── serverList.ts            # Built-in + user server configs (desktop/proxy login)
    ├── keychain.ts              # Saved credentials: OS keychain (desktop) / localStorage (proxy)
    ├── proxy.ts                 # screeps-client-proxy URL mapping
    ├── tauri.ts / embedded.ts   # Desktop / embedded-mod mode detection
    ├── dom.ts                   # DOM helpers
    ├── log.ts                   # Logger factory
    ├── storage.ts               # localStorage key constants
    ├── useRoomNavigationKeys.ts # Keyboard shortcut hook
    ├── useServerInfo.ts         # Debounced pre-login server version/feature probe
    └── useOAuthLogin.ts         # OAuth popup login (Steam, Discord, ...) + provisional-account registration flow
```

## State management

`clientStore.ts` holds SolidJS signals (`client`, `status`, `error`) and functions (`connect`, `disconnect`, `tryAutoConnect`). Credentials persisted to `localStorage` for auto-reconnect. `App.tsx` calls `tryAutoConnect()` on mount.

`RoomViewer.tsx` subscribes to `RoomStore` and `UserStore`, creates `TerrainLayer` and `ObjectLayer`, hands them to `RoomRenderer`.

`RoomRenderer.ts` wraps a PixiJS `Application` in a `world` container with pointer-drag panning, wheel zoom, navigation zones (edge-scroll), and a view-reset method.

## Alliance map overlay

`allianceStore` fetches the League of Automated Nations roster from
`https://www.leagueofautomatednations.com/alliances.js` — a flat JSON object keyed by
alliance abbreviation, served with `Access-Control-Allow-Origin: *`, so the browser
fetches it directly with no proxy. The request is **lazy** and deduped: it fires the first time
the `alliance` overlay mode is selected, or when a player profile is opened. Responses are
cached in `localStorage` for 6h, and a stale cache is still used if the network fails.

`MapInfoPanel` hides the mode button when `isPrivateServer() === true` — the roster describes
nobody there — and resets an active alliance overlay back to `owner`, so connecting to a
private server mid-session can't strand the map in a mode with no button to leave it. `null`
(version probe still pending) shows the button: better than having it pop in late on the
server where it does work. `Profile` gates its roster fetch on the same flag.

Beyond the map, membership surfaces in `RoomInfoBox` (hovered/selected room, any overlay mode)
and as a chip next to the username in `Profile`, both in the alliance's map colour.

Two things the feed does not give you:

- **Colours.** Every alliance ships `"color": "#000000"`, so the field is unusable. Colours
  are derived locally: hash the abbreviation into a 20-entry palette, linear-probe on
  collision, assigning in sorted-abbreviation order. Stable across sessions.
- **A key convention.** `"name"` is a real alliance abbreviation, not metadata — entries are
  filtered by shape (`Array.isArray(members)`), never by key name.

Membership is indexed lower-cased, since the roster's casing doesn't always match the
server's usernames. `MapRenderer.setRoomAlliance` tints **owned** rooms only (map-stats
encodes a reservation as `own.level === 0`) and stamps the abbreviation along the room's
bottom edge; owner badges stay visible in this mode, so the tint says which alliance and
the badge still says which player. The unclaimable wash is suppressed while the mode is
active — otherwise red over every foreign room drowns out the alliance colours.

Badge, mineral icon and alliance label arrive in an order that varies per room, so their
child index is derived (`decorInsertIndex`) rather than assumed: the tint sits directly
above the unclaimable wash, the label above everything but the room name.

Owner stats almost always arrive before the roster does, so `MapViewer` re-applies the
tint for every room it has stats for whenever `allianceMembers()` changes.

The sidebar legend is sorted by how many owned rooms each alliance holds in the current
viewport, with alphabetical as the tiebreak so panning doesn't reshuffle it arbitrarily.
`MapViewer` owns that tally (it has both the viewport and the stats) and publishes it through
`allianceRoomCounts`. Owner stats stream in one room at a time, so recounting per event would
be O(viewport) per message — triggers are coalesced into a single 250 ms-debounced pass, and
only while the overlay is actually on.

## In-room decoration editor

`roomViewStore`'s `decorate` mode places and edits a decoration where it actually sits, in the live room. Entry points: the Decorate button in `RoomInfoPanel` (or `4`), which opens `DecorationPicker` with the account's unplaced decorations; a row in `RoomDecorationsPanel`, for one already in the room; or "Edit in the room view instead" in the inventory dialog. `decorationEditStore` owns the draft and drops it whenever the mode leaves `decorate` — which a room change does, so a draft never outlives its room.

A new placement starts centred rather than at the schema's origin default, which sits under the edge wall, and renders through `decorationPreviewItem()` — so an unplaced decoration is visible in the room before it is ever activated. The picker gates on room ownership using `roomOwner` / `controllerReservation`, which the room subscription already provides, and greys out types the room already holds (`collidingTypes`).

Three things make it work:

- **The camera is locked** (`RoomRenderer.setCameraLocked`) to a fully zoomed-out room while editing. Nothing pans or zooms, so the frame and its handles can stay HTML over the canvas, positioned from `viewTransform`. `PlacementFrame` is that frame, shared with the 2D editor in the inventory dialog; the geometry behind it stays in `positionEditor.ts`.
- **Dragging never rebuilds a layer.** The draft's geometry is pinned in `decorationPreviewItem()`, and the live placement goes straight to the sprites through `DecorationLayer.setTransform`. Only non-geometry edits — colours, alpha, animation — flow through the parse/rebuild path, which is what makes them show up live too.
- **Saving keeps the editor open.** `placeDecoration` is a deactivate-then-activate pair; closing on success would drop the draft before the re-read lands and the decoration would visibly snap back. The saved state becomes the new baseline instead.

Decoration changes made by this client bump `decorationsRevision` (`roomDataStore`), which re-reads `game/room-decorations`. The response is authoritative, so removals propagate; only socket items that arrived while the request was in flight are layered back on top.