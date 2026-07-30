---
'screeps-client': patch
---

Show decoration changes in the room view without reloading the room.

Placing or removing a decoration now re-reads `game/room-decorations` straight away. The room
socket only carries decorations when the server volunteers them, so an activation made from the
inventory — which leaves the room view mounted behind it — stayed invisible until the room was
reloaded.

Removals propagate as well. The re-read treats its response as authoritative instead of merging
it onto everything seen so far, which could only ever add decorations: a deactivated one kept
being drawn. Items that arrive over the socket while the read is in flight are still layered back
on top, so the race that guarded against is unaffected.
