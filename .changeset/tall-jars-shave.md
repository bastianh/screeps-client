---
'screeps-client': patch
---

Fix `syncRotate` creep decorations rendering a quarter turn counter-clockwise.

The artwork is drawn for the reference renderer, whose creep container faces
`atan2(dy, dx) + π/2` — zero means "moving up". Ours faces plain `atan2(dy, dx)`, so an
overlay inheriting that rotation landed 90° off.
