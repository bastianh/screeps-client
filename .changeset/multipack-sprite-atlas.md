---
"screeps-client": patch
---

Support TexturePacker MultiPack sprite atlases. The default theme now loads only
`sprite-0.json`; PixiJS follows `related_multi_packs` to pull in linked sheets,
and `AtlasCache` merges frames from the spritesheet and its `linkedSheets` into
one lookup so sprites split across multiple atlas pages render correctly.
