---
"screeps-connectivity": patch
"screeps-client": patch
---

Fix foreign creep badge and username display in observed rooms.

When observing a room from another player, newly spawned creeps weren't showing
the owner's badge and displayed player ID instead of username. Fixed by:

- Merging user data across ticks instead of replacing, preserving player info
- Adding `badge?: Badge` to the users type throughout the codebase
- Adding `refreshForeignCreepBadges()` to update creep visuals when badge data arrives
