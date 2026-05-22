---
"screeps-client": minor
"screepsmod-client-new": patch
"xxscreeps-mod-client": patch
---

Mods now depend on `screeps-client` instead of bundling their own copy of the client bundle.

`screeps-client` ships three build variants under its published `dist/`:

- `dist/standalone/` — `base=/`, no embedded flag (used for plain hosting)
- `dist/embedded/` — `base=/client/`, embedded mode (used by `screepsmod-client-new`)
- `dist/xxscreeps-mod/` — `base=/`, embedded + xxscreeps mode (used by `xxscreeps-mod-client`)

`screepsmod-client-new` and `xxscreeps-mod-client` resolve the appropriate variant from the installed `screeps-client` package at runtime — they no longer carry their own `dist/` directory or build step. This removes the duplicate copy-into-mod step and makes the version coupling explicit.
