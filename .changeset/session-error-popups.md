---
"screeps-connectivity": patch
"screeps-client": minor
---

Show a dismissable popup (reload/logout) instead of silently bouncing to the login screen when an already-connected session hits a fatal socket error or disconnect. Add a similar popup for 429 rate-limit responses from official servers, with a button to open the server's "disable rate limiting" link (opens the OS browser in the desktop app). Fix the map view not reloading terrain when switching shards — room names collide across shards, so the renderer's terrain cache was serving stale terrain from the previously viewed shard. Also removes the 5-minute sessionStorage cache on `fetchServerVersion` so the pre-login welcome screen always reflects the server's current `/api/version`.
