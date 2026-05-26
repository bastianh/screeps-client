---
title: Room View Architecture
type: note
permalink: screeps-client/project/room-view-architecture
tags:
- architecture
- frontend
- pixijs
- solidjs
- renderer
---

# Room View Architecture

How the room view is built: the split between SolidJS (reactive orchestration) and PixiJS (WebGL rendering), the layer stack, how each subsystem works, and how they wire together.

> Note: supersedes `screeps-client/docs/room-view-architecture.md` (deleted — was outdated).

---

## SolidJS vs PixiJS split

| Concern | Owner |
|---|---|
| Data fetching, subscriptions, reactive state | SolidJS (`RoomViewer.tsx`) |
| Rendering pixels, animation, pointer input on canvas | PixiJS (`RoomRenderer` + layers) |
| Cross-cutting reactive state (selection, view mode, history) | SolidJS signals in store modules |
| Keyboard / pointer events on the page | SolidJS (listeners via `onCleanup`) |

SolidJS is the orchestrator: it owns all application state and reacts to changes, but never draws anything. PixiJS owns the canvas entirely — driven imperatively by method calls from SolidJS effects.

---

## Entry points

**`Dashboard.tsx`** — top-level layout. Renders resizable sidebar (right), bottom console, and the centre canvas area. Passes `room` and `shard` signals down to `RoomViewer`.

**`RoomViewer.tsx`** (~710 lines) — the SolidJS ↔ PixiJS bridge. Responsibilities:
- Create and own `RoomRenderer` on mount; destroy on unmount
- React to `room`/`shard` prop changes: reset all state, tear down old layers, fetch terrain + subscribe room
- Feed terrain into `TerrainLayer`, live ticks into `ObjectLayer.update()`, visuals string into `VisualLayer.update()`
- Wire tile-click handlers dispatching to three interaction modes: `view`, `flag`, `build`
- Handle `overlayAction` (e.g. `moveFlag`) that persists across clicks
- Manage history mode: instantiate `HistoryPlayer`, react to `historyTick()` signal, render tick slider UI
- Register arrow-key navigation, cleaned up on room change or unmount

---

## PixiJS layer stack

All layers live inside `RoomRenderer.world` (a `Container` that owns the pan/zoom transform):

```
world (Container — camera transform)
├── TerrainLayer           (Container)          — static, drawn once on terrain load
├── ObjectLayer            (Container)          — animated game objects
├── ActionAnimationLayer   (Container)          — creep action beams (harvest/build/upgrade)
├── VisualLayer            (Container)          — RoomVisuals overlay (per-tick)
├── HoverHighlightLayer    (Container)          — hover rect + selection overlays
└── NavOverlay             (Container)          — clickable navigation arrows (4 directions)
```

`bringNavOverlayToTop()` is called after each new layer is added to keep NavOverlay and HoverHighlightLayer on top.

---

## RoomRenderer.ts

Owns the PixiJS `Application` and all camera logic.

- **Pan** — pointer drag moves `world.x/y`; clamped to PADDING=48px with elastic over-scroll (OVERSCROLL=128px) during drag, springs back on release
- **Zoom** — mouse wheel scales `world` around cursor; pinch-to-zoom (multi-touch) with ZOOM_RESISTANCE=0.6 rubber-band past min/max; spring-back after wheel settle (80 ms debounce)
- **Bounds** — minScale = viewport size / (ROOM_SIZE + 64); maxScale = 5
- **`screenToTile(sx, sy)`** — converts canvas-space coords to tile [0..49], accounting for world pan/zoom; returns null if outside the 50×50 room
- **Click vs drag** — pointer-up treated as click only if pointer moved < 4 px from pointer-down position
- **`setTileHandlers(onHover, onClick)`** — registers tile-level callbacks. `onHover` fires every `pointermove`; `onClick` fires on short taps with tile coords + ctrlKey flag
- **`setupNavigationZones(handlers)`** — creates four transparent arrow zones outside the room edges; `pointerover` highlights them, `pointerdown` fires direction callback
- **ResizeObserver** keeps `app.renderer` sized to the container element
- **Spring animation** — cubic ease RAF loop to spring positions and scale back into bounds after drag/zoom release

---

## TerrainLayer.ts

A `Container` with three children, built once when terrain data arrives and never redrawn:

1. **`createMainTerrain(terrain)`** — a single `Graphics` object that draws:
   - Base plain fill (full 600×600 px)
   - Swamp tiles: quadrant-based rounded corners (pass 1: outer stroke border; pass 2: fill — two-pass technique so only the outer halo is visible at corners)
   - Wall tiles: same quadrant + two-pass technique
   - Exit arrows: small triangles at room border tiles that aren't walls
   - Room border: 1px stroke around the full room
2. **`createSwampGlow(terrain)`** — a `Graphics` with `BlurFilter(strength=5)` at alpha=0.45, drawn over swamp tiles for the glow effect
3. **`createWallNoise(terrain, renderer)`** — walls filled with a noise color, a `NoiseFilter(noise=0.12)` applied, then baked into a `Sprite` via `renderer.generateTexture()`. The source Graphics is destroyed after baking.

Items 2 and 3 can be toggled via `setTerrainEffectsVisible(layer, bool)` — they correspond to the "terrain effects" user setting. The wall noise Sprite owns its texture; `container.destroy()` is patched to also destroy the texture.

---

## ObjectLayer.ts (~2000 lines)

Manages lifecycle and animation of all game objects.

**Internal state:**
- `objects: Map<id, ContainerWithTarget>` — live PixiJS visual per object
- `rawObjects: Map<id, RoomObject>` — last known data per object (data-space coords, not interpolated)
- `roadGraphics: Graphics` — batched road network, redrawn only when road set changes
- `rampartGraphics: Graphics` — batched rampart tinting, redrawn every update
- `extAnimations`, `creepFillAnimations`, `towerFillAnimations`, `sourceAnimations`, `buildGlowAnimations` — per-object animation state maps (id → ExtAnimation)

**Update cycle** — `update(objects, diff?, users?)`:
- **Diff path** (hot path, called every tick): iterates only changed/added/removed IDs using `for...in` (avoids `Object.entries()` array allocation)
- **Full-state path** (first message per room): iterates all objects, removes orphans via a `seen` Set
- Both paths: new object → `createObjectVisual()`; existing creep → set `__targetX/Y` for lerp; other structures → `position.set()` immediately; deleted → `destroyVisual()` which calls `container.destroy({ children: true })`

**`createObjectVisual(obj, ...)`** — 700-line switch statement, one case per object type. Each type builds a custom PixiJS Container sub-graph. Key examples:
- `creep` — concentric ring (body arcs proportional to part counts, direction notch, inner fill, store fill) + badge Sprite (async) + username label
- `controller` — octagon background + 8-segment progress ring + owner badge Sprite with circular mask
- `source` — energy-proportional rounded rect, animated color pulse via `currentSourceColor(now)`
- `tower` — base circle + rotating turret Container (barrel rect + energy fill rect)
- `extension` — size-scaled by RCL capacity, animated energy fill
- `constructionSite` — progress pie + ring pulsation animation + build glow
- `flag` — pole + dual-color triangular flag + name label
- `road` / `rampart` — empty Container (rendering is batched on the shared `roadGraphics`/`rampartGraphics`)
- `mineral` — colored disc + mineral type glyph

**Ticker callback** runs every frame:
- Lerps creep positions 15% toward `__targetX/Y` per frame (stops at < 0.5 px delta)
- Adjusts creep/flag label scale to stay constant in screen pixels across zoom levels
- Runs source color pulse, tower barrel rotation, CS ring pulsation
- Drives all animation maps (extAnimation, creepFill, towerFill, source, buildGlow) with ease-in-out cubic easing over 300 ms

**Tile queries:**
- `getObjectsAtTile(tx, ty)` — returns `{id, obj, visual}[]` for all objects at that tile (uses `rawObjects` data-space coords, not interpolated visuals)
- `getVisualById(id)` — returns the live Container for the HoverHighlightLayer to track

---

## ActionAnimationLayer.ts

A single `Graphics` object redrawn every frame during active beams. Each beam animation has three phases:
- **Build** (0–50% of duration): beam grows from source toward target
- **Hold** (50–70%): full beam visible
- **Dissolve** (70–100%): beam shrinks backward from source toward target, leaving the end stationary

Beam types triggered from `RoomViewer` on every tick's `actionLog`: `harvest` (yellow), `upgradeController` (blue), `build` (cyan). Attack / heal / rangedAttack are supported by the layer API (`ActionAnimationLayer` has methods ready) but are **not yet triggered** from `RoomViewer`.

---

## VisualLayer.ts

Renders Screeps `RoomVisuals` (the scripting API's drawing primitives). Called with a newline-delimited JSON string every tick.

On each `update(raw)`: destroys all non-persistent children from the previous tick, clears the shared `Graphics`, then parses each line as a `RoomVisualEntry` and draws:
- `l` — line (solid or dashed/dotted via `drawDashedPath`)
- `c` — circle (fill + stroke, dashed stroke via polyline approximation)
- `r` — rect (fill + stroke, dashed via corner path)
- `p` — polygon (fill + stroke, dashed)
- `t` — text (rendered at 4× font size then scaled to 0.25 for crispness; optional background rect)

Text and background `Graphics` nodes are created fresh each tick and destroyed at the start of the next tick (texture churn — a known improvement area).

---

## HoverHighlightLayer.ts

**Hover rect** — a single `Graphics` redrawn on every `pointermove` (via `RoomRenderer`): white-bordered, slightly filled tile rect at the current tile coords.

**Pending tile** — a second marker (dashed-border rect) shown when a tile has been selected for flag/build placement (`setPendingTile`, `clearPendingTile`).

**Selection overlays** — `Map<id, Graphics>`. On `setSelectedObjects(items)`:
- Creep → circle ring centred on the creep's visual container, redrawn every ticker frame to track interpolated position
- Structure / other → white-bordered box at data-space tile position (no interpolation)

---

## Interaction modes (`roomViewStore`)

`roomViewMode()` signal has three values:
- **`view`** (default) — click selects objects; Ctrl+click multi-selects/deselects
- **`flag`** — first click sets pending tile; second click on same tile creates flag with current `flagDraft`; `setPendingTile` highlights the chosen tile
- **`build`** — click places construction site for `buildDraft.structureType`; Ctrl+click removes construction sites at that tile

**`overlayAction`** — a one-shot action that takes over the next click: currently only `{ type: 'moveFlag', name, room, color, secondaryColor }`. The click removes the flag at the old position and creates it at the clicked tile.

---

## History mode

`historyMode()` signal flips `RoomViewer` from live-WebSocket mode to HTTP-polling mode:
- Creates a `HistoryPlayer(room, shard, baseUrl, tokenGetter, chunkSize, isPrivateServer)`
- `HistoryPlayer` fetches tick history in chunks, caches decoded chunks (no eviction limit)
- `createEffect` on `historyTick()` calls `player.getStateAtTick(tick)` → `setObjectState({ objects, diff: undefined })`
- ObjectLayer is put into `instantMode` (no creep movement interpolation)
- A slider UI at the bottom of the canvas drives `seekToTick()` with 150 ms debounce
- `historyMaxTick` is clamped down if the server returns a chunk boundary earlier than expected

---

## Selection system

**`selectionStore.ts`** — module-level SolidJS signal:
```ts
interface SelectedObject { id, type, name?, x, y, raw: RoomObject }
const [selection, setSelection] = createSignal<SelectedObject[]>([])
```

**Selection logic in `RoomViewer`:**
- Normal click → replace entire selection with all objects on the clicked tile
- Ctrl+Click → if any tile object is already selected: deselect those; otherwise add all tile objects to the current selection
- Room change → `clearSelection()` + `r.hoverLayer.clearSelection()`
- Every tick → `updateSelectionWithDiff(diff, objs)` or `updateSelectionFromObjects(objs)` to keep `raw` fields current

After computing new selection: `setSelection(nextSelection)` + `r.hoverLayer.setSelectedObjects(visuals)` (full rebuild, not incremental).

---

## Data flow summary

```
screeps-connectivity (WebSocket)          screeps-connectivity (HTTP)
        │  room:update event                       │  history chunks
        ▼                                          ▼
RoomViewer (SolidJS effects)             HistoryPlayer.getStateAtTick()
        │                                          │
        ├── setObjectState()  ←───────────────────-┘
        │
        ├──► TerrainLayer         (one-off, on terrain load)
        ├──► ObjectLayer.update() (every tick)
        ├──► ActionAnimationLayer (trigger beams from actionLog)
        └──► VisualLayer.update() (every tick, raw visual string)
        
selectionStore (signal)
        │
        ├── HoverHighlightLayer.setSelectedObjects() (imperative, via RoomViewer)
        └── SelectionList (SolidJS component, reads reactively)
```

## Observations
- [architecture] SolidJS orchestrates, PixiJS renders — strict boundary; no SolidJS signals inside renderer classes
- [architecture] ObjectLayer has two update paths (diff/full-state) that are nearly identical 300-line blocks — known duplication
- [architecture] TerrainLayer uses three-child container: main Graphics + swamp glow (BlurFilter) + wall noise (baked Sprite)
- [debt] ObjectLayer createObjectVisual is a 700-line switch; ActionAnimationLayer beams for attack/heal/ranged not yet triggered
- [debt] VisualLayer recreates Text nodes every tick — no diffing or caching
- [fact] TerrainLayer terrain effects (swamp glow, wall noise) can be toggled independently via settingsStore

## Relations
- part_of [[screeps-client Frontend]]
- relates_to [[screeps-client Analysis — What It Does, Gaps, and Improvement Areas]]
