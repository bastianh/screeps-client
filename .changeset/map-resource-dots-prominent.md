---
"screeps-client": patch
"screeps-connectivity": patch
---

Make highway resources easier to spot on the world map. Power banks are now
drawn as larger white dots (radius 1.5 → 2.5) instead of small orange ones, and
deposits — previously rendered as tiny muted-red "foreign" dots because their
`d` map2 key fell through to the generic user-object path — now get the same
prominent white treatment. The deposit key is documented on `RoomMap2Data`.
