---
"screeps-client": patch
---

Fix a memory leak in the room view: switching rooms stranded the PixiJS `GraphicsContext` of every object visual, terrain layer, decoration mask and navigation arrow on the renderer, so memory climbed with each room change and only came back when the room view was left entirely (e.g. by switching to the world map). Teardown now frees those contexts — and the per-room filters that went with them — explicitly.
