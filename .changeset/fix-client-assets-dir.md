---
"screeps-client": patch
"xxscreeps-mod-client": patch
---

Rename Vite assets output directory from `assets/` to `_client/` to avoid collision with the game server's `/assets/` endpoint. The directory name is overridable via the `VITE_ASSETS_DIR` environment variable.
