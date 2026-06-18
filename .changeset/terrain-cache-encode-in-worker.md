---
"screeps-client": patch
---

Stop the map view from freezing when zooming far out. Baking many room tiles at once (a single batch fetches up to 200 rooms) ran the cache-copy encode — `OffscreenCanvas` + `drawImage` + `convertToBlob` — on the main thread once per tile, which could lock up or completely hang the tab. The terrain worker now encodes the cache copy itself (off the main thread) and ships the bytes back alongside the baked bitmap, so the main thread only stores the bytes and uploads the texture. The now-unused `imageBitmapToBlob` helper is removed.
