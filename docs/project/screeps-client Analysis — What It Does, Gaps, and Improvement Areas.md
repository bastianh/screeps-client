---
title: screeps-client Analysis — What It Does, Gaps, and Improvement Areas
type: note
permalink: screeps-client/project/screeps-client-analysis-what-it-does-gaps-and-improvement-areas
tags:
- analysis
- frontend
- improvements
- gaps
---

# screeps-client Analysis — What It Does, Gaps, and Improvement Areas

A detailed assessment of the screeps-client browser app: what it covers well, what is missing, and where the code or UX has room to improve. Based on a full read of the renderer, stores, and component layer.

---

## What the client does well

The renderer is impressively complete for a new-generation client. Every canonical Screeps structure type has a custom visual: creeps with proportional body-part arcs and direction indicator; controller with octagon + 8-segment progress ring + badge; source with energy-proportional shrink + pulsing color; construction site with animated ring pulsation + build glow + progress pie; towers with rotating barrel; extensions size-scaled by RCL capacity; roads drawn as a batched connected-line graph; ramparts as a tinted overlay. The full Screeps palette of minerals, flags, storage, terminal, link, lab, nuker, observer, factory, extractor, ruin, tombstone are all handled.

**Rendering highlights:**
- Smooth creep movement: 0.15 lerp factor per ticker tick. Direction indicator (body-container rotation) updates on each move diff.
- Energy-fill animations: extensions, creep stores, tower energy, sources all animate with an ease-in-out cubic over 300 ms.
- RoomVisuals: full support for line, circle, rect, poly, text — including dashed/dotted stroke — rendered per-tick from the server's raw visual string.
- Action animations: harvest beam, upgradeController beam, build beam all rendered with duration tuned to measured tick length.
- Map view: world-scale Map2 live subscriptions with badge rendering, mineral/density overlays, owner coloring, safe-mode indicator, progressive center-out terrain loading, unclaimable room shading.
- History mode: chunk-based HTTP replay with a debounced seek slider, chunk caching, chunk size adapted to private vs. official server.
- Flag management: create, move, and (implicitly) delete flags directly on the room canvas.
- Construction site management: place, remove (Ctrl+Click), with pending tile highlight.
- Camera: pinch-to-zoom, mouse-wheel zoom around cursor, drag panning, rubber-band resistance past zoom limits, spring-back animation, edge-scroll navigation zones with arrow glyphs.

---

## Missing features

**Game content not yet rendered:**

- **Power creeps** — falls through to the generic rectangle fallback. Power creeps have a distinct visual (larger, with power bars) in the official client that is not implemented.
- **Nuker charges/cooldown** — the nuker shape is drawn but its glyph count and cooldown are not displayed.
- **Factory level** — factory is rendered identically to extractor/invaderCore (dark circle + inner gray). There's no level indicator or commodities overlay.
- **Lab reagents** — a lab's `mineralType` and fill level are not shown. The visual is static.
- **Tombstone/ruin decay counter** — both are rendered but their `ticksToDecay` is not displayed anywhere.

**UI panels not built:**

- **Player inventory / account-level resources** — no panel for credits, pixels, access keys, CPU unlock, etc. The `UserStore` stream receives this data but nothing surfaces it.
- **Market panel** — the library has market HTTP endpoints; no UI exists for active/completed orders.
- **Leaderboard panel** — endpoints exist in the library; nothing uses them in the client.
- **User messages** — the library has user-messages endpoints; no UI exists for in-game messages.
- **Script management** — `CodePanel.tsx` exists with a CodeMirror editor but branch switching, saving/deploying code, and error display are not implemented (or only partially — worth verifying `Branch` type usage).

**UX gaps:**

- **History mode play/pause** — `playbackSpeed` signal exists and is used for animation duration, but there's no play/pause button or speed control in the UI. Scrubbing is the only way to navigate history.
- **Object detail panel** — clicking a tile shows the selection list, but inspecting deep state (Storage/Terminal resource contents, Lab mineral, Creep memory) requires reading raw property values in the SelectionList — there's no structured detail view.
- **Hover tooltip** — hovering a tile does not show any info popup. The hover callback in `setTileHandlers` is a no-op (`(_tx, _ty) => {}`).
- **Shard selector** — no dropdown/tab to switch between shard0/shard1/shard2 in the world map. Users type shard names into the RoomNavigator manually.
- **Console log clear** — no button to clear the console log history.
- **Tick stats in UI** — `tickDuration` signal is computed but only used for animation scaling, not shown in the UI. `StatsBar` shows CPU/memory but not bucket, GCL, GCL progress, or power level.
- **Mobile / narrow-screen layout** — sidebar panels have no responsive breakpoints; the draggable-splitter Dashboard layout will not adapt gracefully to small viewports.

---

## Code-level improvement areas

**ObjectLayer is a 2000-line monolith.** `ObjectLayer.ts` contains `createObjectVisual()`, a 700-line switch statement that handles every object type inline. Adding a new type or editing an existing one requires navigating this single file. Splitting into per-type factory modules (e.g. `visuals/CreepVisual.ts`) would make the code easier to maintain and test in isolation.

**Duplicated update paths.** `ObjectLayer.update()` has two nearly identical 300-line code paths — one for diff updates and one for full-state updates. The diff path was added for performance but the full-state path was not unified with it. The logic for creep movement, flag re-creation, energy animation triggering, and controller redraw is copy-pasted verbatim between the two branches.

**Property bag on PixiJS Containers.** Mutable state (target positions, cached energy values, graphics sub-references) is stored as `__double_underscore` properties on PixiJS `Container` objects via the `ContainerWithTarget` intersection type. This side-steps PixiJS's type system and makes it hard to see what fields a given visual tracks. A typed wrapper class or a parallel `Map<id, VisualState>` would be more maintainable.

**VisualLayer creates Text objects every tick.** `VisualLayer.update()` destroys and recreates all text/background `Graphics` nodes on every game tick, even when the visual string hasn't changed. This fires texture uploads on every tick. Diffing the raw string before redrawing, or caching text nodes by content, would save texture churn.

**History mode duplicates room stats logic.** The object-counting / owner-extraction loop in the history effect is a verbatim copy of the same loop in the live-mode `room:update` handler. Both live in `RoomViewer.tsx`. A shared helper function would keep them in sync.

**RoomViewer.tsx is too large.** The component is ~710 lines and owns: history mode, live mode, terrain loading, object rendering coordination, tile click dispatch for three separate interaction modes (view / flag / build), navigation zone setup, and the history slider UI. A natural split: extract `HistoryControls`, move tile-click dispatch logic into `roomViewStore`, and hoist the terrain subscription into a dedicated hook.

**HistoryPlayer has no memory cap.** `HistoryPlayer` caches decoded chunks in a `Map<chunkKey, ChunkData>` with no eviction. Scrubbing over hundreds of ticks accumulates all chunks in memory without bound. An LRU with a fixed size (e.g. 20 chunks) would prevent unbounded growth.

**Action animation coverage.** The ActionAnimationLayer supports attack, heal, and rangedAttack but `RoomViewer` only triggers harvest, upgradeController, and build from the `actionLog`. Attack/heal/rangedAttack/pull/transfer animations are not fired.

**No keyboard shortcut documentation or discoverability.** Arrow-key room navigation and the `m` key shortcut to enter room view exist, but there's no help overlay or tooltip explaining them.

---

## Architecture observations

- Module-level SolidJS signals mean there can only ever be one active client instance. A second browser tab or a future multi-server view would require a refactor toward signals-in-context.
- The `BadgeTextureCache` is a module-level singleton shared by all `ObjectLayer` instances. Correct for the single-client model, but would need scoping if multi-client is ever added.
- The `showCreepLabels` / `showRoomVisuals` / `terrainEffects` settings are synced via effects that call into the layer APIs — a clean pattern that doesn't require the layers to be reactive themselves.
- The `for...in` micro-optimizations throughout (avoiding `Object.entries()` allocations on the hot update path) are intentional and documented. These should be preserved when refactoring.

## Observations
- [strength] Renderer covers all canonical Screeps structure types with custom visuals and animations
- [strength] ObjectLayer diff path avoids allocation on the hot tick path (for...in instead of Object.entries)
- [strength] History mode with chunk caching, clamping, and adjustable chunk size for private vs official servers
- [gap] Power creeps, nuker charges, factory level, lab reagents, tombstone decay not rendered
- [gap] No history playback controls (play/pause/speed) — slider only
- [gap] No hover tooltip for tile inspection
- [gap] Market, leaderboard, user messages, and script deployment panels absent
- [gap] No shard selector UI in world map
- [gap] Action animations only cover harvest/upgradeController/build; attack/heal/rangedAttack not triggered
- [gap] HistoryPlayer has no chunk eviction — unbounded memory growth when scrubbing
- [debt] ObjectLayer is a 2000-line file with a 700-line switch; should be split by object type
- [debt] Duplicate 300-line update paths (diff vs full-state) in ObjectLayer.update()
- [debt] ContainerWithTarget property bag — side-channels state onto PixiJS objects
- [debt] VisualLayer recreates all Text nodes every tick even on unchanged visual data
- [debt] RoomViewer.tsx is ~710 lines; history mode, live mode, and tile interaction are all mixed
- [architecture] Module-level signals mean single client instance only; multi-server would need context refactor

## Relations
- relates_to [[screeps-client Frontend]]
- relates_to [[screeps-connectivity Library]]
