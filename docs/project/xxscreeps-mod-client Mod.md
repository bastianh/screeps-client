---
title: xxscreeps-mod-client Mod
type: note
permalink: screeps-client/project/xxscreeps-mod-client-mod
tags:
- mod
- xxscreeps
- koa
- esm
---

# xxscreeps-mod-client Mod

An xxscreeps mod (`xxscreeps-mod-client` on npm, v0.2.4) that embeds and serves the `screeps-client` SPA inside an xxscreeps server. ESM module (xxscreeps is a modern ESM-first reimplementation of the Screeps server). xxscreeps is a peer dependency.

The mod has two entry points:
- `index.js` — declares `{ provides: ['backend'] }` manifest
- `backend.js` — the actual implementation, registered as a Koa middleware via `hooks.register('middleware', koa => { ... })`

## How it works

Koa middleware inspects every `GET`/`HEAD` request and routes to one of four outcomes:
1. **Root redirect** — if `mountPath !== '/'` and path is `/`, redirect to `<mountPath>/`
2. **Static file** — if a file exists in `dist/xxscreeps-mod/` at the resolved path, stream it with correct `Content-Type`
3. **SPA shell** — if the path matches a known client route in `SPA_ROUTES` (`/user`, `/profile`, `/messages`, `/market`, `/room-overview`, `/map`, `/room`), serve `index.html` for client-side routing
4. **Pass-through** — any other path falls to `next()` so xxscreeps handles it (its API/website routes are never shadowed; unknown paths get a real 404)

This is an **allowlist** model: the mod claims only the client's own routes. It replaced an earlier blocklist (`SCREEPS_MOD_CLIENT_EXCLUDE` / `await next()` + intercept-404) that forwarded everything except a list of backend prefixes — that inversion mirrors the standalone `screeps-client-proxy` change in PR 0e3915e. `SPA_ROUTES` mirrors `screeps-client/src/stores/routeStore.ts` + `utils/gameRoutes.ts` and must be kept in sync when the client gains a top-level route.

Like `screepsmod-client-new`, the index.html is served with an injected `window.__SCREEPS_CLIENT_EMBEDDED__` script block (kind: `'xxscreeps-mod'`).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `SCREEPS_MOD_CLIENT_MOUNT_PATH` | `/` | URL path to serve client at |
| `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` | `true` when mountPath ≠ `/` | Redirect `/` → `<mountPath>/` |

No modConfig equivalent — xxscreeps mods configure via environment variables only.

## Key differences from screepsmod-client-new

| Aspect | screepsmod-client-new | xxscreeps-mod-client |
|---|---|---|
| Server framework | Express | Koa |
| Module type | CJS | ESM |
| Static serving | `express.static()` | Manual `fs.createReadStream()` |
| Default mount | `/client` | `/` |
| Client build used | `dist/embedded/` | `dist/xxscreeps-mod/` |
| SPA fallback | expressPostConfig hook (after backend routes) | `SPA_ROUTES` allowlist → index shell, else `next()` |
| Config source | env var OR modConfig | env var only |

## Observations
- [design] ESM module using Koa middleware hooks rather than Express route registration
- [design] Static file serving is manual (streams via `fs.createReadStream`) — no Express static middleware available in Koa context
- [design] SPA shell is served only for paths in the `SPA_ROUTES` allowlist; all other paths pass through to xxscreeps, so API/website routes are never shadowed and unknown paths get a real 404
- [design] `SPA_ROUTES` couples the mod to the client's route table (`routeStore.ts` + `gameRoutes.ts`) — a new top-level client route needs a matching entry here
- [version] 0.2.4

## Relations
- part_of [[Screeps Client Monorepo Overview]]
- embeds [[screeps-client Frontend]]
- contrasts_with [[screepsmod-client-new Server Mod]]
