---
"screeps-client": patch
"screepsmod-client-new": patch
---

Add room history mode: replay historical ticks via the screepsmod-history API with playback controls (step, play/pause, speed) in the sidebar and a timeline slider on the room canvas. Fix SPA catch-all in screeps-mod-client shadowing backend routes such as `/room-history` when the client is mounted at `/`.
