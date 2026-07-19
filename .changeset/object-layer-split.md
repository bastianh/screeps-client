---
"screeps-client": patch
---

Split the 4200-line `renderer/ObjectLayer.ts` into per-object modules under `renderer/objects/` — one file per object type (creep, spawn, tower, storage, terminal, lab, …) plus shared helpers, types and a `createObjectVisual` dispatcher. Pure internal refactor: the rendering output, the `ObjectLayer` class API and its animation/update logic are unchanged.
