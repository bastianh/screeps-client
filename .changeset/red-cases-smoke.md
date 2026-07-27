---
'screeps-client': patch
---

Keep the owner badge upright on a moving creep.

The badge sits inside the creep's rotating body container so the store fill can cover it, and
counter-rotated by a fixed quarter turn — which only cancelled the idle heading. Once the creep
moved, the badge tilted with it. Facing changes now go through one helper that keeps the badge
level at any heading, including a badge that arrives after the creep is already on screen.
