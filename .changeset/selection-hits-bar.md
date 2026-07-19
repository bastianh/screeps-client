---
"screeps-client": minor
---

Show a damage-graded hits bar in the object property view. When a selected creep, structure, power bank or ruin is below full health, the selection panel now renders a thin fill bar beneath the numeric hits — green above ~66%, amber in the mid range, red when critical — so damage reads at a glance instead of only from the raw `hits / hitsMax` text. Full-health objects are unchanged. The RCL and store-fill bars now share a single reusable `MeterBar` component.
