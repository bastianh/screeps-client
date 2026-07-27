---
'screeps-connectivity': minor
'screeps-client': minor
---

Keep room decorations live.

Room tick messages can carry a `decorations` field. `RoomStore` now forwards it as a new
`room:decorations` event, and the room view merges those items by `_id` into the list it fetched
over HTTP — so a decoration placed or edited while you are watching the room appears without a
reload. The merge returns the previous list untouched when nothing actually differs, so a server
that repeats the same payload every tick does not rebuild the decoration layer.
