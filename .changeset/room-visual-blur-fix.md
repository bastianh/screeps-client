---
"screeps-client": patch
---

Fix blurry RoomVisuals text: replace PixiJS Text objects with a 2D canvas texture sized to `world.scale × devicePixelRatio × ROOM_SIZE`, giving a 1:1 physical pixel mapping at any zoom level. Eliminates GPU upsampling/downsampling that caused extreme text blur. Also fixes a crash (`source is null`) caused by `Texture.from` cache sharing; solved by always passing `skipCache: true` when recreating the texture on zoom changes.
