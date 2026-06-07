---
"screeps-connectivity": patch
"screeps-client": patch
---

Add `Game.map.visual` rendering support. The map view now subscribes to the `mapVisual` WebSocket channel and renders player-drawn map visuals (lines, circles, rects, polys, text) on the world map canvas using PixiJS.
