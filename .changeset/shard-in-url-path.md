---
"screeps-client": patch
---

Carry the shard as a URL path segment for the map and room views
(`/map/shard0`, `/room/shard0/W11N11`) instead of a `?shard` query param. The
shard segment is optional, so private servers reporting a single shard keep bare
`/map` and `/room/W11N11` URLs. Old `?shard=` bookmarks still resolve.
