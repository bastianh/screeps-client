---
'screeps-client': minor
---

Open the decoration editor straight from the room sidebar.

Clicking one of your own decorations in the room's Decorations panel opens its editor. Decorations
belonging to other players stay inert, since there is nothing to edit.

The open editor now lives in the URL as `/inventory/<id>`, the way the reference client addresses
it. That is what lets a link from the room open it at all — the dialog needs the inventory and the
room list, which the inventory page already has.
