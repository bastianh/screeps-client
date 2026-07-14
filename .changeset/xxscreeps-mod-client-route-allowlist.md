---
"xxscreeps-mod-client": patch
---

Serve the client via a route allowlist instead of a backend-path blocklist. The mod now claims only the client's own SPA routes (`/user`, `/profile`, `/messages`, `/market`, `/room-overview`, `/map`, `/room`) plus real files in `dist/`, and hands every other path straight to xxscreeps. This drops the `SCREEPS_MOD_CLIENT_EXCLUDE` env var and the `await next()`-then-intercept-404 fallback, so new backend routes can never be swallowed into the SPA shell and unknown paths get a real 404. Mirrors the standalone `screeps-client-proxy` change.
