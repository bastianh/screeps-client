---
"screeps-client": patch
---

Match the official client's room-decoration geometry

Landscape overlays diverged from the official renderer, so a decoration pack authored
against one looked wrong on the other:

- Floor and wall overlays always tiled. The official tiles the floor only when the
  *definition* declares `tileScale`, otherwise stretching one copy over the room, and never
  tiles the wall half at all. A placement's `tileScale` prop no longer flips the branch —
  the official ignores it on landscapes.
- Tile scales are now rebased from the official's 100-units-per-tile space onto ours
  instead of a magic `0.8`, so the same authored number gives the same density. The same
  fix applies to tiled `wallGraffiti`, which repeated roughly 8× too often.
- `strokeWidth` and `swampStrokeWidth` were 1.25× too thin. They are SVG units at 100 per
  tile, and `paint-order: stroke` hides the inner half of the centred stroke, so the
  visible border is half the authored width.
- The hardcoded green swamp glow is replaced by the official's additive, green-tinted
  swamp noise, leaving a pack's own `swampColor` readable underneath.
- The procedural wall noise no longer disappears when a wall texture is present; the
  official draws both.
