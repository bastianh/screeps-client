---
"screeps-client": patch
---

Pre-render wall noise terrain as a texture sprite using the renderer. This improves rendering performance by avoiding per-frame NoiseFilter application on the wall noise graphics, and ensures proper cleanup of the generated texture on destroy.
