---
"screeps-client": patch
---

Fix Safari/WebKit terrain tile caching (the real root cause this time). Reading a cached tile back via `Response.blob()` from the Cache API produced a blob whose `blob:` URL WebKit treats as cross-origin, so every decode — both `createImageBitmap(blob)` and the `HTMLImageElement` fallback — failed with `Cannot load blob:… due to access control checks`. On reload this surfaced as a flood of console errors and a stalling map. `getTerrainCacheBlob` now copies the cached bytes into a fresh, page-origin `Blob` (`arrayBuffer()` → `new Blob([...])`), which strips the taint so decoding works in every browser.
