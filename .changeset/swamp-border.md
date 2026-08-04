---
"screeps-client": patch
---

Swamp tiles are drawn with their border again. The decoration's
`swampStrokeColor` and `swampStrokeWidth` were parsed and resolved but never
reached a draw call, so only the fill was painted — and at alpha 0.4 over a
dark themed floor that fill is nearly invisible, which made swamps look as if
they were hidden underneath the ground. The swamp shape now gets the same
stroke-then-fill pass the wall shape already used. Its translucency comes from
an `AlphaFilter` rather than `Graphics.alpha`, because plain alpha is applied
per-vertex: the translucent fill would blend with the border strokes beneath it
instead of covering them, outlining every quadrant sub-path and showing the
seams through as a grid.
