---
"screeps-client": patch
---

Render deposits with proper artwork in the room view. The sprite atlas gains
shape + fill frames for all four commodity types (biomass, metal, mist,
silicon), and the renderer now draws a deposit as two stacked layers tinted by
type using the official commodity colors. The fill layer is kept mostly
transparent so the rock shape reads through. Falls back to the previous colored
rectangle when no theme/atlas or an unknown deposit type is present.
