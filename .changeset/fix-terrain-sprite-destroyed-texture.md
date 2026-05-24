---
"screeps-client": patch
---

Fix crash when zooming out fast with uncached terrain tiles. A race condition caused the map renderer to destroy a terrain texture while the sprite still referenced it, leading to a PixiJS crash reading `alphaMode` from a null source. The sprite is now cleared before any texture it references is destroyed.
