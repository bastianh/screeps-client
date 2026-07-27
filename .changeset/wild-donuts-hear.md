---
'screeps-client': patch
---

Fix the inventory's room, theme and decoration lists never loading or refreshing.

All three took their dependency by reading it inside the fetcher, which `createResource` runs
exactly once — so whatever wasn't ready when the page mounted stayed missing for the rest of the
session. The room picker was hit hardest, since it also needs the user id. They now take their
dependency as a source signal, and the room list refreshes when the editor opens so claiming or
losing a room mid-session can't leave a stale picker.
