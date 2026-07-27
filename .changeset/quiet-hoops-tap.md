---
'screeps-client': patch
---

Fix the decoration editor crashing on open.

A memo evaluated at setup read an accessor declared further down the component, so opening any
decoration that offers a position editor threw `Cannot access 'selectedRoomName' before
initialization`. The room accessors now sit above their first use.
