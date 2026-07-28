---
'screeps-client': minor
---

Edit room decorations in the room view itself, instead of on a separate 2D canvas.

Clicking one of your decorations in the room sidebar now opens it for editing where it actually
sits: the frame is dragged, resized and turned over the live, ticking room, with the artwork
following it wall-masked and tinted as it will really look. The sidebar carries the same numbers
and properties the dialog offers, so colours, alpha and animation update live too.

While editing, the camera parks on the whole room and stops panning and zooming — the decoration
stays reachable end to end, and the frame can sit as HTML over the canvas. Right-click leaves the
mode, a room change abandons the draft, and saving keeps the editor open rather than closing it
under the re-read it triggers.

The dialog's 2D editor stays for decorations whose room is not the one on screen, and history
playback still edits through the inventory — it is a read-only view of a past tick.
