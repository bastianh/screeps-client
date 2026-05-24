# Terrain Visual Effects

**Date:** 2026-05-24
**Status:** Approved

## Goal

Add subtle visual effects to room terrain — a green atmospheric glow on swamp tiles and a noise-grain roughness overlay on wall tiles — togglable via SettingsPanel. No new npm dependencies.

## Architecture

`createTerrainLayer` in `screeps-client/src/renderer/TerrainLayer.ts` currently returns a `Graphics`. It will be changed to return a `Container` holding three children in z-order:

```
Container
  ├── swampGlow    Graphics  — blurred green halo, z-order: below main terrain
  ├── mainTerrain  Graphics  — existing layer, content unchanged
  └── wallNoise    Graphics  — noise-filtered overlay, z-order: above main terrain
```

The caller (`RoomViewer.tsx`) receives one object and adds it to the world exactly as today. The only breaking change at the call site is the return type: `Graphics → Container`.

## Effects

### Swamp glow

- Same quadrant geometry as the existing swamp fill pass
- Fill color: `0x2A4A20` (more saturated green than `TERRAIN_SWAMP_FILL`)
- Filter: `BlurFilter({ strength: 5, quality: 3 })` from `pixi.js` core
- Alpha: `0.5`
- Placed behind `mainTerrain` so blur bleeds outward from swamp edges

### Wall roughness

- Same quadrant geometry as the existing wall fill pass
- Fill color: `0x282828` (slightly lighter than `TERRAIN_WALL_FILL = 0x181818`)
- Filter: `NoiseFilter({ noise: 0.12, seed: 1 })` from `pixi.js` core
- Placed above `mainTerrain`, visible only within wall tile area
- The grain gives a rough-stone feel without any texture asset

## Settings

- Add `terrainEffects: boolean` (default `true`) to `settingsStore`
- `RoomViewer` reads the signal reactively and sets `swampGlow.visible` / `wallNoise.visible` — no layer recreation needed
- `SettingsPanel` gets a labeled toggle

## Shared geometry

`drawTerrainQuadrants` is already a standalone function in `TerrainLayer.ts`. It is reused by both effects with different fill color/filter applied — no geometry duplication.

## Out of scope

- Animated effects (e.g. pulsing glow)
- Per-zoom-level effect intensity
- Mask-based texture overlays (noise filter covers the roughness requirement without texture assets)

## Files affected

| File | Change |
|---|---|
| `screeps-client/src/renderer/TerrainLayer.ts` | Return `Container` instead of `Graphics`; add `createSwampGlow` and `createWallNoise` helpers |
| `screeps-client/src/renderer/colors.ts` | Add `TERRAIN_SWAMP_GLOW` and `TERRAIN_WALL_NOISE` color constants |
| `screeps-client/src/stores/settingsStore.ts` | Add `terrainEffects` boolean field |
| `screeps-client/src/components/RoomViewer.tsx` | Update type from `Graphics` to `Container` |
| `screeps-client/src/components/SettingsPanel.tsx` | Add terrain effects toggle |
