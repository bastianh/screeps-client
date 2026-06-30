---
"screeps-connectivity": minor
"screeps-client": patch
---

Add `MapStatName`, `MapStatPrefix`, `MapStatInterval` const objects and `mapStat()` helper for typed map-stats API access; add `TerrainColors` interface and decoration fields to `MapStatsRoomData`; expose `MapStatsStoreEvents` and `statName` in room events.

Client: world map shard selector, "out of borders" black overlay, reveal-when-ready terrain/stats sync, mineral overlay on demand, room terrain decorations from player themes.
