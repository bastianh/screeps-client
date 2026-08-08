---
'screeps-client': patch
---

Match the official client's RoomVisual style defaults: text is centered instead of left-aligned, and a `stroke` colour on its own now outlines text and shapes (`strokeWidth` defaults to 0.15 for text and 0.1 for circles, rects and polys). An unstyled `poly()` gets the reference's white outline.
