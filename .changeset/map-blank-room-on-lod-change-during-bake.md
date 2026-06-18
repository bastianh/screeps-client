---
"screeps-client": patch
---

Fix map rooms staying permanently black when zooming while terrain is still loading. `setRoomTerrain` captured the LOD at the start of the bake and only applied the texture if the LOD was still the same when the (async) bake finished — so zooming across the LOD threshold mid-bake left the sprite empty, yet the room was marked baked and never re-requested. Recovery was impossible because the raw terrain bytes were only kept at LOD 0, so `applyLOD` could never bake the missing LOD-0 texture for a room first baked at LOD 1.

Raw bytes are now kept for every baked room (freed in `clearRoom`), and a shared `ensureCurrentLod` helper applies — or lazily bakes from raw — the texture for whatever LOD is current, both right after a bake and on every LOD change, in either zoom direction.
