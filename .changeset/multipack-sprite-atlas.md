---
"screeps-client": patch
---

Support TexturePacker MultiPack sprite atlases. The default theme now loads only
`sprite-0.json`; PixiJS follows `related_multi_packs` to pull in linked sheets,
and `AtlasCache` merges frames from the spritesheet and its `linkedSheets` into
one lookup so sprites split across multiple atlas pages render correctly.

Render towers from the sprite atlas: a static `ring` tinted by ownership and a
rotating `body` (the cannon), with the energy level drawn as a procedural rounded
rect scaled by fill. When a tower attacks, heals, or repairs it now turns its
barrel toward the target and draws a colored beam (red/green/cyan) for the action,
then resumes its idle sweep from that position.
