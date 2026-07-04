---
"screeps-connectivity": patch
"screeps-client": patch
---

Fix Steam/password logins silently expiring after ~5 minutes on screepsmod-auth servers. These logins reconnect via a rotating, TTL-limited session token, but `TokenAuth` was hard-coded to ignore the server-issued `X-Token`, so the client kept replaying the original token until the server expired it — surfacing as a sudden `401` on `/api/user/world-status` (and every other authed request) even while actively using the client.

`TokenAuth` now accepts `supportsTokenRefresh` (default `false`, preserving durable personal-API-token behavior). The client enables it for Steam/password-derived session tokens so the rotated `X-Token` is adopted on every response, keeping the session alive.
