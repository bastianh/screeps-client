---
'screeps-client': minor
---

Carry the world map position in the URL so a view can be bookmarked.

The map now writes its centre and zoom into the query as `?zoom=<z>&pos=<x>,<y>` — the same room
coordinates the official client uses, where `.5` is a room's centre. Panning and zooming update the
URL with `replaceState` once the view settles, so it never adds history entries and Back still leaves
the map. Opening such a URL (or using Back/Forward) restores that exact view instead of dropping back
to the account's start room, and switching shards keeps the position.
