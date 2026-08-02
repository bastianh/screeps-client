---
"screeps-client": patch
---

Fix custom UI buttons often needing several presses before they react. The room's owner and controller reservation were rebuilt as fresh objects on every room update, so their signals fired once per tick; combined with the panel's per-run rebuild of its element list this recreated every button's DOM node each tick, and a button replaced between mousedown and mouseup never fires a click. Both signals now compare by value, and the sidebar panel and the per-object actions reuse stable entry objects.

The structure counts and the room's user map are compared by value too, which stops the build panel and the room info panel from re-rendering on every tick of an idle room.
