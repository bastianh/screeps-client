---
'screeps-connectivity': patch
'screeps-client': minor
---

Render `wallGraffiti` room decorations.

Graffiti images now draw between the terrain and the objects, masked to the room's walls, with
tint, per-graphic alpha, tiling, rotation and horizontal flip applied. The five alpha animations of
the official renderer (`slow`, `fast`, `blink`, `neon`, `flash`) are driven off a single ticker
callback, and `lighting`-enabled items are drawn a second time above the darkness overlay so they
stay bright — the same trick the reference renderer's separate lighting layer performs.

`ROOM_DECORATIONS_MOCK` gained a synthetic `wallGraffiti` entry so the path can be exercised
without owning one.
