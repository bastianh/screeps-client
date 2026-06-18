---
"screeps-client": patch
---

Fix two Safari/Firefox map view rendering bugs:

- **Terrain tile caching never worked in Safari.** The Cache API write succeeded, but reading the cached WebP blob back via `createImageBitmap(blob)` failed in WebKit with an "access control checks" error (the internal `blob:` URL is treated as cross-origin). The error was swallowed and surfaced as a permanent cache miss, so every tile was re-baked. `blobToImageBitmap` now detects the gap once and falls back to decoding via an `HTMLImageElement` object URL, which works in every browser.
- **Map view crashed when zoomed far out after a view switch** (`TypeError: null is not an object (evaluating 'r.addressModeU')`). `MapRenderer.destroy()` passed `texture: true` to `app.destroy()`, which also destroyed the globally shared `Texture.EMPTY` referenced by every empty/unbaked terrain sprite. The next renderer instance then crashed on rendering those tiles. Terrain textures are already destroyed manually, so `texture: true` was removed.
