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

Room lighting now follows the same reference, which changes how every room reads, not
just decorated ones:

- The dark overlay was a flat 20% black veil. It is now a light map — mid-grey ambient,
  multiplied over the world — so unlit ground sits at half brightness as it does
  officially, and lights screen it back towards white instead of erasing holes in it.
- Walls cast a soft blurred shadow onto the floor, and their own faces are lit back up,
  so a room reads with depth rather than flat.
- Wall noise was a flat grey wash at 50% that pulled decorated walls towards neutral and
  cost a landscape its colour. It is now additive at 20%, as officially.
- `strokeLighting` is honoured: it sets how brightly a wall's rim reads in the light map.
