---
'screeps-client': minor
---

Place decorations by dragging them around the room.

Once a target room is picked, the decoration dialog shows the room's terrain with a frame over it:
drag to move, eight handles to resize, and a grip to rotate. Which of the three is offered comes
from the decoration's own schema — a read-only `rotation` means no rotate grip — and `proportional`
decorations keep their aspect ratio while resizing.

The room is drawn as flat terrain rather than a full render: walls are what matters when placing
graffiti, which only shows on them.
