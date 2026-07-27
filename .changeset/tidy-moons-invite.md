---
'screeps-connectivity': minor
'screeps-client': minor
---

Room decorations: rework the parsing foundation ahead of graffiti/creep/object rendering.

- Decoration `brightness` props now scale HSL lightness like the official renderer instead of
  multiplying RGB channels — floor, wall, road and texture colours were visibly off whenever
  brightness was below 1.
- Landscapes are first-wins per room (matching the reference renderer) instead of last-wins, and
  the combined `landscape` type is finally recognised as both a floor and a wall landscape.
- Graffiti, creep and object decorations are parsed into typed lists (sprites with their
  `color`/`alpha`/`visible` prop references resolved, `!SEP!` name filters split, animation names
  validated). Rendering for them follows in a later change.
- Turning the "room decorations" setting back on now re-fetches immediately instead of waiting for
  the next room change.
- Decoration textures load through a shared, deduplicating cache.
- `ApiRoomDecorationDef` gained the `landscape` and `badge` types plus `tiling`/`objectType`;
  `ApiRoomDecorationActive` gained the geometry, animation and targeting fields.
