---
"screeps-connectivity": minor
"screeps-client": patch
"xxscreeps-mod-client": patch
"screepsmod-client-new": patch
---

Embedded clients are now configured from the first frame with no `/api/version` round-trip: both the xxscreeps mod and the classic server mod prefetch the version payload and inline it into the page (`window.__SCREEPS_BOOTSTRAP__`), and the client seeds it into both the pre-login UI and the connection. `ScreepsClient` gains an `initialVersion` option and `ServerStore` a `seedVersion()` method to support this.
