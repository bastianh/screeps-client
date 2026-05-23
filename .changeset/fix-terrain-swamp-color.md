---
"screeps-client": patch
---

Fix rooms with no swamp tiles rendering entirely in swamp color.

Calling `fill()`/`stroke()` on an empty PixiJS 8 path can reapply the style
to the previous path context. Added a `pathDrawn` guard so the terrain
stroke/fill is only applied when at least one tile was actually drawn.
