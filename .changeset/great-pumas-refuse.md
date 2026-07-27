---
'screeps-client': minor
---

Render `creep` and `object` room decorations.

Creep overlays now apply to their owner's creeps, honouring the `!SEP!` name filter and its
`exclude` inversion, skipping creeps that are still spawning, and following the body rotation when
`syncRotate` is set. Object overlays apply to every object of their target type. Both support the
alpha animations and per-graphic tint and alpha.

Sizes for these two types arrive in the reference renderer's pixels rather than room cells, so they
are converted on the way in — a 256 is 2.56 cells, not 256.

The six identical object-visual creation blocks in `ObjectLayer` were collapsed into one helper.
