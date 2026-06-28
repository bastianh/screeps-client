---
"xxscreeps-mod-client": patch
---

Default mount path is now `/` instead of `/client`. The shipped bundle references some assets (e.g. the sprite atlas under `themes/`) at the server root, so mounting under `/client` left those URLs 404ing. Mounting at `/` makes the client work out of the box without setting `SCREEPS_MOD_CLIENT_MOUNT_PATH`. The `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` default now also follows the documented behavior (redirect only when the mount path is not `/`).
