---
'screeps-client': patch
---

Hide the room sidebar's Decorate button while room decorations are switched off.

With the decorations setting off the room draws none of them and the client fetches none, so the
editor's entry point led into an empty view. The mode button and its `4` shortcut are now gone
along with the decorations, and the inventory's "edit in room" hand-off is offered only while they
are on.

Turning the setting off with the editor already open closes it back to view mode instead of leaving
it stranded.

The list of decorations placed in the room moved into decorate mode's sidebar as well — it is the
counterpart to the picker's unplaced ones, and no longer takes up room above the selection, flag and
build panels.
