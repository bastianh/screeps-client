---
"screeps-connectivity": patch
---

Fix cache/storage namespace collision when two distinct game worlds are hosted under the same domain via a path (e.g. Screeps World vs Screeps Season on screeps.com) — terrain and other cached data no longer bleed between them.
