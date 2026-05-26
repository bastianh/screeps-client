---
title: Room & Map View — SolidJS Refactoring Opportunities
type: note
permalink: screeps-client/project/room-map-view-solid-js-refactoring-opportunities
tags:
- refactoring
- frontend
- solidjs
- architecture
- roomview
- mapview
- cleanup
---

# Room & Map View — SolidJS Refactoring Opportunities

A focused review (2026-05-26) of the SolidJS layer for the two main views — the room view (`RoomViewer.tsx`, 706 lines) and the map view (`MapViewer.tsx`, 392 lines) — plus their stores and how `Dashboard.tsx` switches between them. Goal: identify what is worth cleaning up / refactoring and in what order. This complements [[Room View Architecture]] (which describes how things work today) by recording where the structure has drifted and what to do about it.

The overall verdict: the rendering side (PixiJS) is well-factored into layers, but the **SolidJS orchestration has accreted** — `RoomViewer` is a god component, the live vs. history data paths duplicate logic verbatim, and the two views are **architecturally asymmetric** (room side uses global stores; map side prop-drills through Dashboard).

## Findings

### 1. `RoomViewer` is a god component (706 lines)
It owns, in one function: PixiJS renderer lifecycle; the live WebSocket subscription + `room:update` parsing; the history-mode HTTP polling effect; terrain application (in two places); object-layer creation + per-tick update; the full tile-click interaction state machine (~150 lines, 4 modes inline); action-animation triggering; the RoomVisuals update; **and** the entire history slider UI as inline JSX at the bottom. Almost every concern in the room view lives in this single component.

### 2. Verbatim duplication: live vs. history object summarization
The `for (const id in objects)` loop that counts objects, sums structure types, and extracts the controller owner/level appears **twice, nearly identical**: the live `room:update` handler (RoomViewer.tsx ~100–147) and the history `getStateAtTick` handler (~189–220). This is the single clearest extraction: a pure `summarizeRoomObjects(objects, users) → { objectCount, structCounts, owner, ctrlLevel }` helper, trivially unit-testable, consumed by both paths.

### 3. Two data-application paths that should converge
Live and history mode both end with: `setObjectState(...)`, `setGameTime(...)`, then the summarize loop, then writing the five `roomDataStore` signals. They could feed a single `applyRoomSnapshot(snapshot)` function so there is one place that maps a room state → store, regardless of source (WebSocket vs. HTTP).

### 4. Tile-click interaction state machine is inline
The click handler (RoomViewer.tsx ~405–552) branches across `moveFlag` overlay / `flag` / `build` / `view` modes with HTTP calls, selection rebuilds, and pending-tile management inline. This belongs in a dedicated interaction module (e.g. per-mode handlers) so `RoomViewer` wires it up rather than implementing it. Note: the handler is intentionally `eslint-disable solid/reactivity` because it must read live `props.room/shard` at click time — any extraction must preserve that.

### 5. Two overlapping nav-zone setup effects (fragile)
`RoomViewer` rebuilds navigation zones in the room-change "clear" effect (~234–289) **and** in a separate worldBounds/onNavigate effect (~295–327). The comments explicitly acknowledge the overlap and the races they guard against (terrain pre-load, worldBounds arriving post-login). This works but is fragile and hard to reason about; consolidating needs care precisely because of those documented races — treat as a lower-priority, higher-risk cleanup.

### 6. Inline history slider duplicates the sidebar's history UI
`RoomViewer` carries `sliderValue` signal + `seekDebounceTimer` + ~50 lines of slider JSX, while `historyStore` already owns tick state and a `HistoryControlPanel` already exists in the sidebar. The inline slider should be its own component and ideally share debounce/seek logic with the panel.

### 7. View asymmetry: map view prop-drills, room view uses stores
The room side reads/writes global stores (`roomDataStore`, `roomViewStore`, `selectionStore`). The map side instead lifts `hoveredRoomInfo`, `selectedRoomInfo`, `mapZoom`, `mapSubsActive` into `Dashboard` via callbacks and drills them down into `Sidebar` (~6 props). A `mapViewStore` (mirroring the existing `mapOverlayStore`) would let `MapViewer` write directly and `Sidebar`/`MapInfoPanel` read directly — removing the callbacks and several Dashboard-local signals, and making the two views structurally consistent.

### 8. `MapViewer` is a large stateful controller with embedded subsystems
It holds several plain (non-reactive) `Map`s — `roomStats`, `roomUnclaimable`, `roomBadgeKeys`, `map2Subs` — which is *correct* for perf (keeps hot paths out of reactivity), but bundles three self-contained subsystems inline: (a) the progressive **terrain-loading queue** with center-out batching (~73–99, 224–244), (b) **map2 subscription reconciliation** by zoom threshold (~250–276), and (c) **mapStats event handling + unclaimable computation** (~355–382). Each is a candidate for extraction into a hook/helper (e.g. `createMapTerrainLoader`, `createMap2Subscriptions`) to shrink the component and make the logic testable.

### 9. `roomViewStore.tsx` mixes too many concerns
One file holds: interaction signals (mode, drafts, pending tile, overlay), domain constants (`CONTROLLER_STRUCTURES`, `FLAG_COLOR_MAP`), HTTP side-effect logic (`confirmBuild` does place-spawn/create-construction), and a JSX view helper (`modeHint`, the reason for the `.tsx`). Splitting domain tables / interaction state / view-helper would clarify responsibilities and drop the JSX from a "store".

### 10. `Dashboard` embeds routing logic
`Dashboard` parses and builds room+map URLs, handles `popstate`, navigation events, and history-tick→URL-hash syncing (~29–53, 138–156, 251–297) — ~150 lines of routing woven into a layout component. Extracting a `useRouting`/navigation hook would separate URL/route concerns from layout and shrink the component.

## Recommended ordering
**High value, low risk (do first):**
1. Extract `summarizeRoomObjects()` — kills the verbatim live/history duplication (finding 2). Pure, testable.
2. Introduce `mapViewStore` for hovered/selected room + zoom + subsActive (finding 7) — removes prop-drilling, fixes the view asymmetry, shrinks Dashboard + Sidebar.
3. Extract the tile-click interaction state machine out of `RoomViewer` (finding 4), preserving the live-props read.

**Medium:**
4. Unify live/history into one `applyRoomSnapshot` path (finding 3).
5. Extract `MapViewer`'s terrain-loading queue and map2 reconciliation into hooks (finding 8).
6. Move the inline history slider into a component, share logic with `HistoryControlPanel` (finding 6).
7. Extract `Dashboard` routing into a `useRouting` hook (finding 10).
8. Split `roomViewStore.tsx` into domain constants / interaction state / view helper (finding 9).

**Lower priority, higher risk (do carefully, last):**
9. Consolidate the two nav-zone setup effects (finding 5) — guarded races are documented in comments; must preserve behavior.

## Risk notes
- `RoomViewer` effects encode subtle ordering/race handling: terrain pre-load applied inside the clear effect, nav-zone rebuild duplication, and `eslint-disable solid/reactivity` on the click handler and the map2/mapStats listeners (they must read live props at invocation, not re-bind). Any extraction must keep these invariants.
- `MapViewer`'s plain `Map`s are deliberately non-reactive for hot-path perf — extractions should keep that property, not "reactify" them.

## Observations
- [finding] RoomViewer.tsx (706 lines) is a god component mixing renderer lifecycle, data subscription, history polling, interaction, and slider UI
- [finding] The object-summarize loop is duplicated verbatim between the live room:update handler and the history getStateAtTick handler
- [finding] Room view uses global stores; map view prop-drills hovered/selected/zoom/subsActive through Dashboard → Sidebar — an architectural asymmetry
- [finding] RoomViewer has two overlapping nav-zone setup effects whose race-guards are documented in comments — fragile
- [finding] roomViewStore.tsx mixes interaction signals, domain RCL/color tables, HTTP side-effects, and a JSX view helper in one file
- [finding] Dashboard embeds ~150 lines of URL routing / popstate / history-tick-URL-sync inside a layout component
- [recommendation] First refactor: extract pure summarizeRoomObjects() to kill live/history duplication — lowest risk, testable
- [recommendation] Add a mapViewStore (mirror mapOverlayStore) to remove map-view prop-drilling and match the room-view store pattern
- [recommendation] Extract MapViewer subsystems (terrain queue, map2 reconciliation, mapStats handling) into hooks; keep their Maps non-reactive
- [risk] RoomViewer interaction/listener handlers intentionally suppress solid/reactivity to read live props at invocation — extractions must preserve this
- [risk] MapViewer's plain Maps are deliberately non-reactive for hot-path perf — do not reactify during extraction

## Relations
- relates_to [[Room View Architecture]]
- relates_to [[screeps-client Analysis — What It Does, Gaps, and Improvement Areas]]
- part_of [[screeps-client Frontend]]
