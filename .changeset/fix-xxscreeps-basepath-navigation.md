---
"screeps-client": patch
---

Fix URL accumulation when navigating between room and map views in the xxscreeps build. The relative `BASE_URL` (`./`) used for the xxscreeps bundle was causing `basePath()` to return `'.'`, which made `history.pushState` calls use relative URLs that compounded `/room/` into the path on every navigation. Page reload also failed to parse the room from the URL for the same reason.
