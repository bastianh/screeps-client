# xxscreeps-mod-client

[xxscreeps](https://github.com/laverdet/xxscreeps) mod that serves [`screeps-client`](../screeps-client) on the same server it runs on. The client connects to its own origin, so no separate hosting or CORS setup is required.

## Install

Add the package to your `.screepsrc.yaml`:

```yaml
mods:
  - xxscreeps/mods/classic
  - xxscreeps-mod-client
```

xxscreeps must be installed as a peer dependency.

## Configuration

Environment variables:

| Setting | ENV | Default |
| --- | --- | --- |
| Mount path | `SCREEPS_MOD_CLIENT_MOUNT_PATH` | `/` |
| Redirect `/` → mount path | `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` | `true` if `mountPath !== '/'`, else `false` |

When mounted at `/`, the mod only serves paths that map to an existing file in the client bundle or that look like an SPA route (no file extension). Requests to xxscreeps' own endpoints (`/api/`, `/socket/`, …) are passed through to subsequent middleware.

### Example

```sh
SCREEPS_MOD_CLIENT_MOUNT_PATH=/play npx xxscreeps start
```

## How it works

The mod resolves the client bundle from its [`screeps-client`](../screeps-client) dependency at runtime — no separate build step is needed. The shipped bundle is built with `base=./`, but the client resolves some assets (e.g. the sprite atlas under `themes/`) against the server root `/`. Mounting anywhere other than `/` therefore breaks those asset URLs and requires a custom build of `screeps-client` with a matching base — which is why the mount path defaults to `/`.

## xxscreeps mode

The client bundle shipped with this mod is built with `VITE_XXSCREEPS=true`. In this mode the client auto-connects to its own origin as a guest (read-only) on first load, mirroring `@xxscreeps/client`'s default UX. A "Connect as Guest" button stays available in the login form so users can return to guest mode after signing out.

The xxscreeps server must allow guest access (`backend.allowGuestAccess: true` in `.screepsrc.yaml`, which is the default).

## Notes

This mod serves only the static client bundle. Whether every client feature works against xxscreeps depends on how completely xxscreeps reimplements the Screeps HTTP/WebSocket protocol — that is a concern of [`screeps-connectivity`](../screeps-connectivity), not this mod.
