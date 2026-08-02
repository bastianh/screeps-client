---
'screeps-client': patch
---

Fix the decoration editor's inputs losing a drag or keystroke.

The property list was rebuilt on every edit, so the browser lost the element it was dragging: a
slider let go after a couple of pixels, a text field dropped focus after one character, and the
colour picker closed itself. The controls now stay put while the values change, in the room
sidebar's decorate panel and in the inventory dialog alike.
