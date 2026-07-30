---
'screeps-client': patch
---

Preselect the open room when placing an unplaced decoration from the inventory.

Opening the inventory while a room is on screen is a strong hint about where a decoration is meant
to go, so its room picker now starts there instead of on "Select a room…" — and the position editor
comes up with that room's terrain straight away.

Only for decorations that are not placed anywhere: one that already sits in a room keeps pointing
at it, and a room chosen by hand is never overwritten. Rooms the account does not hold, and rooms
whose decoration of that type is already taken, are skipped.
