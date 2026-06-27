---
"screeps-connectivity": patch
---

Fix world bounds calculation for single-quadrant maps (e.g. E/S-only servers) — previously the client assumed a symmetric world and mapped e.g. E0S0–E11S11 to W6N6–E5S5.
