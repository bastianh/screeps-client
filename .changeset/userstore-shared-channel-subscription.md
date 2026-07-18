---
"screeps-connectivity": patch
---

Fix duplicated console output when multiple parts of the app subscribe to the same `UserStore` channel. `subscribe()` now installs a single shared, ref-counted socket subscription and listener per channel instead of one listener per caller, so each incoming frame is processed and re-emitted exactly once. The server subscription and listener are torn down only after the last subscriber disposes.
