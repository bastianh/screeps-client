---
'screeps-connectivity': minor
'screeps-client': minor
---

Bring world-map decorations up to the reference client.

`map-stats` returns decoration definitions in a top-level dictionary keyed by the id each room
stat references. That dictionary was previously discarded, so the map had to guess what a
decoration was from its colour properties and could only ever tint plains and swamps. It is now
resolved, which brings the map wall colour, both landscape overlay textures and graffiti.

Colours follow the reference map layer's maths: each layer is desaturated by its own factor (0.48
for walls, 0.5 for floors, 0.75 and 0.35 for the overlay textures) so a decorated room still reads
as a map tile. Swamps mix 70% of the already-desaturated plain colour with 30% of the raw swamp
colour.

The road colour was being stored but never drawn — it now tints the map's road overlay.

**Breaking (`screeps-connectivity`):** `MapStatsRoomData.terrainColors` and the `TerrainColors` type
are replaced by `MapStatsRoomData.decorations` and the `MapRoomDecorations` / `MapLandscape` /
`MapGraffiti` types. The store now reports raw decoration values and leaves the colour maths to the
renderer.
