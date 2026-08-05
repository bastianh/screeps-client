---
'screeps-connectivity': minor
'screeps-client': minor
---

Offer badge symbols granted by decorations in the badge editor. A worn `badge`-type decoration (xxscreeps decorations mod) grants an svg symbol; the badge editor now lists those beside the 24 numbered shapes and saves them through the existing `/api/user/badge` route. `ApiRoomDecorationDef` gained the `badge` field and the `BadgeSymbol` type is exported.
