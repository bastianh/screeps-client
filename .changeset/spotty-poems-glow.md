---
"screeps-client": patch
---

Match the official client's light pools and wall shadows

Every object punched the same three-tile pool at full alpha into the light map, which is
the size and strength the official client reserves for a spawn — a base full of extensions
therefore washed out into one bright cloud. Each type now contributes the pools its own
metadata gives it: an extension's halo grows with its tier and only lights while it holds
energy, a lab lights only for a non-energy payload, a storage's core only when it holds
something, sources, minerals, deposits, portals and keeper lairs light in their own colour,
and roads, walls, ramparts, construction sites and flags stay dark as they do officially.

Wall shadows were twice as wide as the reference's. Both blur by the same fraction of the
room, but PixiJS v7 spreads that figure across its passes and lands at half of it, where v8
normalises its passes to hit it exactly.
