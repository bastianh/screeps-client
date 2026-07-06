---
"screeps-client": patch
---

Only render non-public creep sayings to the creep's owner. The renderer previously drew every `say` bubble regardless of the `isPublic` flag, so private sayings could leak to other players on servers that don't filter them out. It now shows a saying only when `isPublic` is true or the creep belongs to the logged-in user.
