---
'screeps-client': minor
---

Place and edit room decorations in the room view itself, instead of on a separate 2D canvas.

A new Decorate mode (the palette button beside View / Flag / Build, or `4`) lists the decorations
the account owns but has not placed; picking one drops it into the middle of the room, where it is
visible before it is ever activated. Clicking one of your already-placed decorations in the room
sidebar opens the same editor for it.

Either way the frame is dragged, resized and turned over the live, ticking room, with the artwork
following it wall-masked and tinted as it will really look. The sidebar carries the same numbers
and properties the dialog offers, so colours, alpha and animation update live too.

While editing, the camera parks on the whole room and stops panning and zooming — the decoration
stays reachable end to end, and the frame can sit as HTML over the canvas. Right-click leaves the
mode, a room change abandons the draft, and saving keeps the editor open rather than closing it
under the re-read it triggers.

Only rooms the account owns or reserves offer placement, and a type the room already holds — a
second wall landscape, say — is greyed out in the list rather than failing on the server.

The dialog's 2D editor stays for decorations whose room is not the one on screen, and history
playback still edits through the inventory — it is a read-only view of a past tick.
