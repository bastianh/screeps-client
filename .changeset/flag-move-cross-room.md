---
"screeps-client": patch
---

Fix flag move mode: setting the overlay action no longer re-triggers the room-change effect (was calling r.clear() + objLayer.destroy(), breaking rendering). Zoom is now preserved when navigating between rooms during a move. A "Target room" input in the flag detail panel lets you move flags to any room without navigating there first.
