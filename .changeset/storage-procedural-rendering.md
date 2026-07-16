---
"screeps-client": patch
---

Draw storage procedurally instead of from the spritesheet. The shape now follows the official client's art — a rounded "barrel" shell with an owner-tinted outline over a grey inner box — replacing the old octagon, with the arcs transcribed from upstream's `storage-border.svg`. Resource bands are unchanged. The structure is scaled down to just over one tile rather than upstream's half-tile overhang in every direction, via a single `STORAGE_SCALE` constant.
