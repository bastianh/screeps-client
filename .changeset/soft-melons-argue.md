---
'screeps-connectivity': minor
'screeps-client': minor
---

Place and remove decorations from the inventory.

Clicking a decoration opens an editor for its properties — colours, ranges, checkboxes, the
animation preset, and the creep name filter with its `exclude` inversion — plus the target room,
and activates or deactivates it.

The room picker disables rooms that already hold a clashing decoration, following the reference
client's rules: the combined `landscape` type blocks both halves, a wall and a floor landscape
coexist, skins and object overlays clash only with their own type, and graffiti is unrestricted.
Creep and badge decorations are account-wide and skip the room picker entirely.

Geometry shows as numeric controls for now; dragging a decoration around a room preview follows.

`screeps-connectivity` gained `user.decorations.activate()` / `.deactivate()`, a `reservation`
flag on `user.rooms()`, and the `ApiDecorationProp` / `ApiDecorationProps` schema types.
