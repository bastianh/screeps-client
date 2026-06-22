---
"screeps-client": patch
---

Poll world status frequently while waiting on a respawn or first-spawn placement so the client reacts almost immediately. When status is `lost` or `empty` the client now refreshes once a second instead of relying on the slow idle path, and triggering a respawn opens a short force-poll window that catches the state change even while the server still reports the old status.
