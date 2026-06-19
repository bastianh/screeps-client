---
"screeps-client": patch
---

Cache-bust the sprite atlas JSON by client version. `public/` assets aren't
content-hashed by Vite, so `themes/default/test.json` keeps a stable URL across
releases and the embedded mod serves it without `Cache-Control` — browsers then
cache it heuristically and keep stale frames after a spritesheet update (only
the image inside the JSON carried a `?v=` hash). This left newly added sprites
(e.g. deposits) blank on deployed servers while everything worked locally.
Appending `?v=<clientVersion>` to the atlas URL forces a fresh fetch on each
release; Pixi propagates the query to the atlas image, so resolution is
unaffected.
