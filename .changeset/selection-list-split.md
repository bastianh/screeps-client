---
"screeps-client": patch
---

Split the 1280-line `SelectionList.tsx` into `components/selection/` — one file per detail view (creep, flag, controller, extension, store structures, power bank, ruin, default), shared lookup tables/styles in `shared.ts`, and the type→component registry in `registry.ts`. `SelectionList.tsx` keeps only the list and item chrome. Pure internal refactor, no behavior change.
