---
"screeps-client": patch
---

Make the room dark-overlay light pools follow creeps smoothly during movement.
Lighting is now a GPU lightmap (a RenderTexture composited from a dark rect plus
`erase`-blend light sprites) instead of a canvas re-baked once per tick, so each
light tracks its creep's interpolated motion every frame instead of snapping at
tick end — with no per-frame canvas redraw or texture re-upload.
