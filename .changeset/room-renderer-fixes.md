---
'screeps-client': patch
---

Room renderer fixes and cleanups:

- Storage, container, terminal, lab, nuker, powerSpawn, extractor and factory visuals now update during history playback and full reconciles — the diff and full update paths share one per-object update function.
- Right/middle clicks no longer count as tile clicks or start a pan; navigation arrows trigger on tap instead of pointer-down, so a touch drag starting on one pans instead of navigating.
- The PixiJS application is destroyed instead of leaking a WebGL context when the room view unmounts while the renderer is still initialising.
- Canvas selection rings/boxes now follow the selection store, so a selected creep dying or a sidebar deselect clears its overlay.
- Room updates apply their signals in one batch, so the render effect runs once per tick instead of several times.
- Enabling the dark overlay builds the lightmap immediately instead of waiting up to a tick.
- A failed flag move restores the flag at its previous position instead of silently deleting it.
- The per-frame ticker consolidates its object loops, and the zoom limit is a single constant.
