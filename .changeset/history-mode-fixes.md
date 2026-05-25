---
"screeps-client": patch
---

Fix stale visuals, selection data and duplicate chunk downloads in history mode; add instant-mode animations, debounced slider, URL hash permalinks (#tick=N), unified mode button row with Clock icon, and read-only action buttons in history mode. Restore road and rampart graphics after ObjectLayer.clear() so they remain visible when leaving history mode. Add Creep-Namen and Room-Visuals toggles to the room info panel. Fall back to the previous history chunk when the current one has not been written yet.
