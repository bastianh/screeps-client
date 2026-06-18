---
"screeps-client": patch
---

Fix slow, stuttering map terrain loading when zooming far out.

- **No more main-thread freeze.** The cache-copy encode (`OffscreenCanvas` + `convertToBlob`) ran on the main thread once per baked tile; a batch of up to 200 rooms could lock up or completely hang the tab. The terrain worker now encodes the cache copy itself, off the main thread.
- **Visible tiles no longer wait for caching.** The worker posts the baked bitmap back immediately and encodes + sends the cache copy as a separate follow-up message, so rendering is never gated behind the encode.
- **No more duplicate fetches/bakes.** `hasRoom()` only turns true once a bake completes, so rooms already being fetched/baked were re-queued on every `visibleRooms` change, multiplying terrain requests and worker bakes. In-flight rooms are now tracked and excluded until their bake finishes.

The now-unused `imageBitmapToBlob` helper is removed.
