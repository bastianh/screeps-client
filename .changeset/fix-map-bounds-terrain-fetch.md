---
"screeps-client": patch
---

Fix rooms outside world bounds being marked with the red unclaimable overlay and triggering unnecessary terrain/stats fetches. The visible-room list is now clamped to the world bounds rectangle, and a negative cache prevents re-fetching rooms the server returns no terrain data for.
