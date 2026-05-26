---
title: screepsmod-client-new Server Mod
type: note
permalink: screeps-client/project/screepsmod-client-new-server-mod
tags:
- mod
- screeps-server
- express
- commonjs
---

# screepsmod-client-new Server Mod

A Screeps private server mod (`screepsmod-client-new` on npm, v0.2.5) that embeds and serves the `screeps-client` SPA at a configurable URL path on the game server's Express backend. CJS module (the Screeps server ecosystem expects CommonJS mods).

The mod exports a single function that receives the Screeps server `config` object. It hooks into `config.backend` lifecycle events to register Express routes before and after the server's own routes are set up.

## How it works

1. **`expressPreConfig`** hook — registers exact index routes and static file serving for the client's `dist/embedded/` directory. Serves the root redirect (optional) here too.
2. **`expressPostConfig`** hook — registers a SPA catch-all fallback *after* backend routes (so `/api/...` and `/room-history` are not shadowed).
3. **Index injection** — reads `dist/embedded/index.html` and injects a `<script>` tag with `window.__SCREEPS_CLIENT_EMBEDDED__` metadata (kind, packageName, version) before `</head>`. This is how the client knows it's running in embedded mode.

## Configuration

| Mechanism | Key | Default | Purpose |
|---|---|---|---|
| env var | `SCREEPS_MOD_CLIENT_MOUNT_PATH` | `/client` | URL path to serve the client at |
| env var | `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` | `true` | Redirect `/` → `<mountPath>/` |
| modConfig | `config.common.modConfig.client.mountPath` | `/client` | Same as env var, lower priority |
| modConfig | `config.common.modConfig.client.rootRedirect` | `true` | Same as env var, lower priority |

Environment variables take priority over `modConfig` values.

## Install usage

```js
// mods.json
{ "mods": ["screepsmod-client-new"] }
```

Express is a peer dependency (optional in metadata, but required at runtime from the Screeps server's own deps).

## Observations
- [design] CJS module to match Screeps server's CommonJS mod loading system
- [design] Index HTML injection happens at request time (not build time), so the version metadata reflects the currently installed package
- [warning] If GET / is already registered by another mod, the root redirect will silently not take effect — a console warning is printed
- [dependency] Depends on screeps-client dist/embedded/ build being present in the published package
- [version] 0.2.5

## Relations
- part_of [[Screeps Client Monorepo Overview]]
- embeds [[screeps-client Frontend]]
