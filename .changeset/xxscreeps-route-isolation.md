---
"xxscreeps-mod-client": patch
---

Default mount path changed from `/` to `/client` to avoid interfering with xxscreeps game server routes. When mounted at `/` explicitly, known server paths (`/api/`, `/socket`, `/backend/`, `/auth/`, `/assets/`, `/map/`) are now skipped via a configurable `SCREEPS_MOD_CLIENT_EXCLUDE` env var.
