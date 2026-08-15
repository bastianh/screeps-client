---
"screeps-client": patch
---

Fix decorated rooms flashing undecorated on every room change: terrain comes out of a cache and was drawn immediately, while decorations always need an HTTP round trip, so the room was painted plain and repainted decorated a moment later. The first terrain draw of a room now waits for its decoration read to settle — with a 500 ms deadline so a slow or failing request still gets the plain room up.
