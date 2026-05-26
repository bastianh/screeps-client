---
title: Room View Textures & Themes — Design Proposal
type: note
permalink: screeps-client/project/room-view-textures-themes-design-proposal
tags:
- design
- frontend
- pixijs
- renderer
- textures
- themes
- proposal
---

# Room View Textures & Themes — Design Proposal

Exploratory design for introducing **bitmap textures / sprite atlases** into the room view, instead of (or alongside) the current fully-procedural PixiJS `Graphics` rendering of game objects. The motivating idea (from dafire, 2026-05-26): ship structure art as a TexturePacker-built sprite/texture atlas, start with a few structures, extend with frame animations, allow sprites to be slightly larger than one tile (overhang) while still scaling naturally with zoom, and eventually let the user pick a **theme** (an atlas/spritesheet) that changes how objects look.

This note captures the recommendation, why it fits the existing architecture, and the main design decisions and risks to resolve before building.

## Why this fits the current architecture

The renderer is **not** starting from zero — two existing caches already prove the exact patterns an atlas approach needs (see [[Room View Architecture]]):

- `StructureTextureCache.ts` — bakes a procedural `Graphics` (e.g. the extension shell) into a cached `Texture` via `renderer.generateTexture()`, keyed by a string, rendered at `max(2, devicePixelRatio)` resolution, with a proper `destroy()` that frees GPU textures. This is the "build once, reuse many" texture pattern.
- `BadgeTextureCache.ts` — async loads SVG → canvas → `Texture.from(canvas)`, dedups concurrent requests with a `pending: Map<key, Promise<Texture>>`, renders at 2×DPR, frees on `destroy()`. This is the proven **async texture loading + fallback** pattern.

So the foundation (texture caching, async load with dedup, DPR-aware resolution, cleanup discipline) already exists. An external atlas is the same idea with the texture source being a TexturePacker spritesheet instead of a baked Graphics or an SVG.

`ObjectLayer.createObjectVisual()` is a ~700-line switch with one case per object type, each hand-building a procedural Container. **That switch is the natural seam** for a theme system: the per-type procedural builder becomes the built-in default theme; a sprite theme is just an alternate provider.

## Recommended approach

### 1. Use PixiJS v8 native spritesheet support — don't roll a custom atlas parser
PixiJS v8 `Assets.load(atlasJsonUrl)` consumes TexturePacker's JSON Hash/Array format directly, and `AnimatedSprite` handles frame sequences natively. This matches the project's "use platform/framework primitives, minimal custom infra" philosophy. TexturePacker → PixiJS is a first-class, well-trodden path.

### 2. Model themes as a "render strategy" keyed by object type
Define a `Theme` interface that maps `structureType → SpriteSpec`:
```
SpriteSpec {
  frame: string | string[]   // atlas frame name, or frame list for animation
  anchor: {x, y}             // e.g. {0.5, 0.5} centered, or {0.5, 1.0} base-aligned/standing
  tileScale: number          // 1.0 = exactly one tile; 1.4 = 40% overhang
  fps?: number               // for AnimatedSprite loops
}
```
The current procedural builders stay as the **built-in "vector" theme** (always available, always complete). A sprite theme is another implementation selected via `settingsStore`. **Themes may be partial** — if a theme has no frame for a given structure type, fall back to the procedural renderer for just that type. This keeps themes incremental and removes the "must redraw everything" barrier.

### 3. Overhang + zoom: lean on the existing camera transform
All object visuals live under `RoomRenderer.world`, the Container that owns the pan/zoom transform. If a sprite's world-space size is set once in tile units (e.g. `sprite.width = TILE_SIZE * tileScale`), it scales with zoom **for free** — no per-zoom work. This is different from labels, which must counter-scale every frame to stay constant in screen pixels; sprites are the easy case. Use an anchor of `{0.5, 1.0}` (base-aligned) for "tall" structures so overhang grows upward from the tile, which reads naturally.

### 4. Z-ordering becomes load-bearing once sprites overhang
Today object draw order doesn't matter much because procedural visuals stay within their tile. Overhanging sprites overlap neighbors, so the layer needs `sortableChildren = true` with `zIndex` derived from tile Y (lower-on-screen draws in front). This is a real new requirement, not a nicety — flag it for the implementation.

### 5. Hybrid art + data overlay for animations
The renderer has live, data-driven visuals (energy fill %, controller progress ring, store fill, construction progress). Don't try to bake those into atlas frames. Recommended split:
- **Sprite (atlas):** the static or looping base art of the structure — uses `AnimatedSprite` for ambient loops (e.g. spawn pulse, tower idle).
- **Procedural Graphics overlay (kept):** data-bound indicators drawn on top — energy bars, progress rings, fill levels.

This preserves all the live-data visualization the client is good at, while the art layer gets a visual upgrade. It does mean two animation mechanisms coexist (AnimatedSprite playback + the existing single ticker callback) — acceptable, but keep ambient-loop art on AnimatedSprite and data easing on the ticker; don't blend them.

### 6. Async load with procedural fallback
Atlas load is async (like badges). Render the procedural visual immediately, swap to the sprite when the spritesheet resolves. Cache the loaded `Spritesheet` once at the renderer/app level (not per object); dedup with the established pending-promise pattern. On theme change, do a full ObjectLayer rebuild — rare event, and a full rebuild path already exists for selection.

### 7. Asset pipeline — bundle first, user-supplied later
- **v1:** bundle one or two themes as static assets in `screeps-client` (Vite static/import-URL), referenced via `Assets.load(url)`. These ship through the mod packages (`screepsmod-client-new`, `xxscreeps-mod-client`) that serve the embedded client.
- **Later:** user-supplied / remote atlases (URL or upload). Defer because of CORS, validation, GPU texture-size limits, and handling untrusted content. Get the seam and bundled themes right first.

### 8. Performance is likely a net win
A single atlas page is one GPU texture → strong sprite batching and far fewer draw calls than today's many independent `Graphics`. For object-dense rooms this should *help*, complementing the RenderTexture-per-room idea in [[Map2 Rendering Optimization — Plan Assessment]]. Watch: atlas page size vs. GPU max texture size (multi-page atlases work but reduce cross-page batching).

## Suggested first slice (de-risk before expanding)
Start with **2–3 mostly-static, visually distinct structures** where art adds the most and data overlays are minimal: e.g. **spawn, tower, storage/terminal**. Explicitly **avoid creeps first** — creep visuals are the heaviest data-driven case (body-part rings, direction notch, store fill, badge, label) and would entangle the art seam with the most complex overlay. The first slice should validate: the theme provider seam, atlas async loading + fallback, overhang anchoring, zoom behavior, and Y-based z-ordering.

## Open questions to resolve before building
- Anchor convention: center `{0.5,0.5}` vs base-aligned `{0.5,1.0}` — probably per-SpriteSpec, defaulting base-aligned for tall structures.
- How partial-theme fallback is surfaced to the user (silent vector fallback is simplest).
- Whether ambient animations belong in the atlas (frame loops) or stay procedural for structures that already animate well.
- Theme packaging/manifest format (a small JSON describing atlas url + per-type SpriteSpec map).

## Observations
- [decision] Keep procedural Graphics renderers as the built-in default/fallback theme; sprites are an alternate provider, not a replacement
- [decision] Use PixiJS v8 `Assets.load` for TexturePacker JSON + `AnimatedSprite` for frame loops — no custom atlas parser
- [decision] Themes may be partial; missing structure types fall back to procedural rendering per-type
- [technique] Sprites under `world` Container scale with zoom for free by setting world-space size in tile units once #zoom
- [technique] Hybrid rendering: atlas sprite = base/ambient art, procedural Graphics overlay = live data (energy/progress/store)
- [requirement] Overhang requires `sortableChildren` + Y-based `zIndex` on ObjectLayer to avoid wrong overlap #zorder
- [requirement] Atlas loads async — render procedural fallback first, swap on resolve; cache Spritesheet once at renderer level
- [recommendation] First slice: spawn/tower/storage (static, distinct); avoid creeps first (heaviest data-driven overlay)
- [recommendation] v1 bundles themes as Vite static assets shipped via the mod packages; user-supplied/remote atlases deferred (CORS, validation, untrusted content)
- [strength] StructureTextureCache + BadgeTextureCache already prove the texture-cache, async-load-with-dedup, and DPR/cleanup patterns the atlas needs
- [risk] Two animation systems (AnimatedSprite + existing ticker) will coexist — keep ambient art on one, data easing on the other
- [perf] Single atlas page = one GPU texture → better batching / fewer draw calls than many Graphics; complements Map2 RenderTexture idea
- [question] Anchor convention, partial-theme UX, ambient-vs-procedural animation split, and theme manifest format still open

## Relations
- extends [[Room View Architecture]]
- part_of [[screeps-client Frontend]]
- relates_to [[Map2 Rendering Optimization — Plan Assessment]]
- relates_to [[screeps-client Analysis — What It Does, Gaps, and Improvement Areas]]


## Implementation Plan — First Slice (spawn / tower / storage)

Grounded in the actual code (verified 2026-05-26):
- `RoomRenderer.app` is `public readonly` → `app.renderer` can be passed to an atlas cache (same shape `StructureTextureCache` already expects).
- `createObjectVisual(obj, showLabel, currentUserId, _badge, badgeCache, users)` (ObjectLayer.ts:350) is a module-level function with a `switch(obj.type)`; spawn=531, tower=709, storage=752, each drawing onto the shared `g: Graphics`.
- The badge async-swap (ObjectLayer.ts:475 / :1872) is the exact "create empty Sprite, set `.texture` once the async load resolves" pattern to reuse for atlas frames.
- `settingsStore.ts` uses a `boolSetting(key, default)` helper backed by `localStorage` + `LS` keys; theme selection needs a new string setting.
- `StructureTextureCache.ts` exists but is **not wired in anywhere** — prepared infra / template, not live.

### Steps
1. **Assets** — TexturePacker atlas (JSON Hash + PNG) with frames `spawn`/`tower`/`storage`, placed under `screeps-client/public/themes/<name>/` (Vite static, `Assets.load(url)`-able). Ships through the mod packages that serve the embedded client.
2. **Theme model** (`src/renderer/themes/Theme.ts`) — `SpriteSpec { frame: string | string[]; anchor: {x,y}; tileScale: number; fps?: number }`; `Theme { id; name; atlasUrl; sprites: Partial<Record<string, SpriteSpec>> }`. Registry `themes.ts` with the built-in `vector` theme (empty sprite map → pure procedural) + one sprite theme.
3. **Atlas cache** (`src/renderer/AtlasCache.ts`) — wraps `Assets.load(atlasUrl)` → `Spritesheet`; dedups with a `pending` Promise map (mirror `BadgeTextureCache`); `getTexture(frame)`, `getAnimationTextures(frames)`, `destroy()`.
4. **Settings** — add `strSetting` helper + `LS.theme` key (`utils/storage.ts`); export `[theme, setTheme]` defaulting to `'vector'`; dropdown in `components/SettingsPanel.tsx`.
5. **Sprite provider in ObjectLayer** — pass active theme + AtlasCache into ObjectLayer (constructor arg + `setTheme()`). In `createObjectVisual`, before the procedural case for a themed type: if `theme.sprites[obj.type]` exists → build a `Sprite` (anchor per spec, `width=height=TILE_SIZE*tileScale`, centered on tile). If the atlas texture is ready, set it now; else render procedural fallback and swap on resolve (badge pattern). Data overlays (tower energy, storage fill) stay procedural on top.
6. **Z-order** — `objectsContainer.sortableChildren = true`; set each visual's `zIndex = tileY` on create and on position update so lower rows draw in front (needed once sprites overhang).
7. **Theme change** — `objectLayer.setTheme(theme)` does a full rebuild from `rawObjects` (reuse full-state path). Wire a SolidJS `createEffect` on `theme()` in `RoomViewer.tsx`.
8. **Animations (optional this slice)** — for `frames`+`fps`, build `AnimatedSprite().play()`; clean up in `destroyVisual`.
9. **Cleanup/verify** — `AtlasCache.destroy()` on renderer teardown (sprite textures owned by the Spritesheet — never destroy per-sprite). Browser check: zoom scales sprites + correct overhang, z-order, theme switch, fallback-before-load.

### Sequencing note
Steps 2–4 are independent and can land first (pure additions, no behavior change). Step 5 is the only one touching the hot `createObjectVisual` path. Ship the `vector`-default no-op first so nothing changes until a user opts into a sprite theme.

## Observations
- [plan] First slice = spawn/tower/storage via a Theme provider in createObjectVisual; vector theme is the no-op default
- [fact] StructureTextureCache.ts exists but is unused/unwired — prepared infrastructure to model the AtlasCache on
- [fact] Badge async-swap at ObjectLayer.ts:475/:1872 is the reuse pattern for "empty Sprite now, set texture on async resolve"
- [decision] Land theme model + atlas cache + settings (steps 2–4) before touching the hot createObjectVisual path (step 5)


## Decisions — Manifest handling & Animation granularity (2026-05-26)

### Two manifests, handled differently
There are really **two** data files, not one:
1. **TexturePacker atlas JSON** (frame name → rect/pivot in the PNG).
2. **Theme / SpriteSpec mapping** (structure type → frame, anchor, tileScale, fps) — the design data from this proposal.

**Atlas JSON → runtime.** PixiJS v8 is built for this: `Assets.load(atlasUrl)` parses the TexturePacker JSON and builds the `Spritesheet` at runtime (same pattern `BadgeTextureCache` already uses). Pre-processing it at compile time buys nothing — PixiJS needs the JSON at runtime anyway — and would break the swappable-theme / future user-supplied-atlas goal. **Vite nuance:** resolve the *reference* at build time for fingerprinting + bundle-existence guarantee, but keep *parsing* at runtime:
```ts
import atlasUrl from './themes/default/atlas.json?url'  // Vite hashes + guarantees existence
const sheet = await Assets.load(atlasUrl)               // parsing stays runtime
```

**SpriteSpec mapping → compile-time TS** (for bundled themes). Author it as a TS module, not JSON → type-checking, autocomplete, frame names validated against a string union, tree-shakeable. What cannot be fully checked at compile time: that referenced frame names actually exist in the atlas — that only resolves once the `Spritesheet` is loaded. A light dev-time assertion on load suffices: `if (!sheet.textures[spec.frame]) warn(...)`. This split is exactly what lets future **user-supplied themes** load *both* files at runtime (atlas JSON + a theme-manifest JSON).

### Animation granularity — sprite frames vs. procedural overlay
Dividing line: **continuous/quantitative data → procedural overlay; ambient or discrete state → sprite.**

| Visual | Mechanism |
|---|---|
| Base art, idle/ambient loops (spawn pulse, tower idle, flag wave) | `AnimatedSprite` (atlas frames) |
| Discrete state variants (controller level 1–8, on/off, rampart y/n) | frame swap: `sprite.texture = frame` |
| Fill levels, progress rings/pies, store fill, energy bars | **procedural `Graphics` overlay** |
| Selection highlights, action beams | stay procedural (as today) |

**Why fill levels stay procedural, not sprites:**
- Continuous 0–100% can't be frame-encoded without ugly quantization (frame-per-percent × every structure × every theme is absurd) or masking.
- The value changes every tick and lerps — a Graphics redraw / scale / mask is trivial and exact (already how the client works).
- The fill math is theme-independent — it must live in one place, not be re-implemented per theme. A new theme supplies **art only**, never fill logic.
- Sprite-based fill is *possible* (rect/radial mask, or empty/full clipped pairs) but costs batching perf, radial masks are fiddly, and it forces every theme artist to author aligned empty/full pairs. Not worth it.

**Architecture rule:** draw procedural overlays in **tile-space** (relative to the tile, not the sprite art) so they align consistently across themes even when the art differs. The atlas sprite stays a single static/looping texture → maximal batching; the overlay carries all live data.

## Observations
- [decision] Atlas JSON loads at runtime via Assets.load; resolve the URL at build time with Vite `?url` for fingerprinting — parsing stays runtime
- [decision] SpriteSpec/theme mapping authored as compile-time TS (type-checked, frame names as string union); frame-existence checked at runtime on atlas load
- [decision] Continuous/quantitative visuals (fill, progress, store) = procedural Graphics overlay; ambient loops + discrete state = atlas sprite/frame-swap
- [decision] Do NOT use sprite frames or masks for continuous fill levels — quantization/masking cost + per-theme art burden not worth it
- [technique] Draw data overlays in tile-space (not sprite-space) so they align across themes regardless of art; sprite stays one static/looping texture for batching
- [fact] The two-manifest split (runtime atlas JSON + compile-time TS mapping) is what enables future user-supplied themes to load both files at runtime


## Refinement — stacked sprites & tint (2026-05-26)

Refines the earlier "don't use sprites for fill levels" stance, which was too absolute. The real driver is **tint (free, batches) + the partial-reveal mechanism (scale batches, mask does not).**

**`tint` is the underrated tool.** A single sprite with `sprite.tint = color` covers all color variation for free (no extra frames, no extra draw call, stays batched). Use it for foreign-vs-own coloring, flag colors, energy-present states, etc.

**Flags → multi-sprite + tint (recommended, replaces the procedural triangle).** Pole sprite (static) + cloth sprite tinted with the primary color + optional band sprite tinted secondary, or an `AnimatedSprite` for waving cloth. Covers all 10×10 color combos with zero per-color frames.

**Fill levels — depends on shape, because of batching:**
| Reveal mechanism | Batching | Distortion | Verdict |
|---|---|---|---|
| Scale (height = fill%) | preserved | only correct for uniform art (a bar) | good for bars |
| Mask (rect/radial) | **broken** — one draw call per masked object | correct for any shape | costly with many structures |

The crux: **scaling does NOT break PixiJS batching; masking does.** With hundreds of structures per room, a per-object mask is a real cost.

So, refined:
- **Bar-style fill** (straight energy/progress bar): two stacked sprites (track + fill) with the fill sprite scaled along one axis — no mask, no distortion (a bar is uniform lengthwise), stays batched. **Fine as sprites.**
- **Shaped/radial fill** (round tank filling, controller pie ring): needs a mask → batching cost. **Stays procedural** (simpler and exact), or quantized frames if discrete steps look acceptable.

## Observations
- [technique] `sprite.tint` is free and batches — use it for all color variation (own/foreign, flag colors, states) instead of per-color frames
- [decision] Flags → multi-sprite + tint (pole + cloth tinted primary + band tinted secondary), replacing the procedural triangle
- [decision] Bar-style fills → two stacked sprites with axis-scale reveal (batches, no distortion); shaped/radial fills → stay procedural (mask breaks batching)
- [fact] In PixiJS, scaling a sprite preserves batching but masking breaks it (one draw call per masked object) — the deciding factor for sprite-vs-procedural fill


## Clarification — "radial" splits into concentric vs. angular (2026-05-26)

The earlier "shaped/radial fills stay procedural" was imprecise. "Radial" means two different things, and only one needs a mask:

- **Concentric fill** (radius/area grows with the value — a tank filling from the center, a growing energy disc): a **scaled inner circle sprite works, no mask needed**, stays batched, `tint` free. This is conceptually how the client already renders source energy and extension fill (proportional inner shape). Nuance: area grows with radius², so scale the radius by `√(fill)` if you want the *area* to read as proportional (purely cosmetic — Screeps' own client isn't strict about this).
- **Angular / sweep fill** (the value sweeps *around* the circle 0→360° — controller progress ring, construction-site progress pie): **scaling cannot do this** (a scaled circle is just a bigger concentric circle). Needs a mask, quantized angle frames, or — simplest — a procedural `g.arc()` (one call, cheaper than any sprite trick).

Practical upshot for the controller: the **level** (discrete 1–8) can be a frame swap; the **progress within a level** (angular sweep) stays a procedural arc.

Final fill decision table:
| Fill type | Mechanism |
|---|---|
| Concentric (radius/area grows) | scaled inner sprite — no mask, batches |
| Bar (linear) | two sprites + axis-scale |
| Angular / sweep (progress ring, pie) | procedural arc (or quantized frames) |

## Observations
- [decision] Concentric fills (radius/area grows) → scaled inner circle sprite, no mask, batches; only angular/sweep fills need procedural arc or mask
- [technique] For area-proportional concentric fill, scale radius by √(fill) since area grows with radius² (cosmetic)
- [decision] Controller: discrete level → frame swap; angular progress within a level → procedural arc
