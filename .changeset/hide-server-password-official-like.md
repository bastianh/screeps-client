---
"screeps-connectivity": minor
"screeps-client": minor
---

Hide the connection ("server") password field for xxscreeps servers.

`screeps-connectivity` adds a `hasOfficialLike(version)` capability helper that
detects the `official-like` feature advertised at `/api/version`. The login
screens (web and desktop) now use it to hide the server-password field on
xxscreeps servers, where the screepsmod-auth connection password does not apply.
