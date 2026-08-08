---
'screeps-client': patch
---

Bring back the memory tree's per-node reload buttons and give the bottom bar a collapse toggle again.

Since watch values moved to typed HTTP fetches, the reload button was gated on a WebSocket placeholder that no longer reaches the tree, so it never rendered. Every object and array node now has one, and it writes the refetched subtree back into the watch store instead of a node-local copy, so live change signals keep updating the node afterwards.

The bottom bar gained a collapse/expand button next to the popout action, and collapsing it by hand sticks: the effect that mirrors the pane toggles no longer reacts to the bar's own height, which previously snapped a bar dragged shut back open and discarded a collapsed bar on reload.
