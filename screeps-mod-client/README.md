# screeps-mod-client

Screeps private-server mod that serves [`screeps-client`](../screeps-client) at `/client` on the same server it runs on. The client connects to its own origin, so no separate hosting or CORS setup is required.

## Install

Add the package to your server's `mods.json`:

```json
{
  "mods": [
    "node_modules/screeps-mod-client"
  ]
}
```

## Configuration

Two layers, in order of precedence:

1. Environment variables (highest)
2. `modConfig.client` in `mods.json`
3. Defaults

| Setting | ENV | `modConfig.client.*` | Default |
| --- | --- | --- | --- |
| Mount path | `SCREEPS_MOD_CLIENT_MOUNT_PATH` | `mountPath` | `/client` |
| Redirect `/` → mount path | `SCREEPS_MOD_CLIENT_ROOT_REDIRECT` | `rootRedirect` | `true` |

### Docker example

```sh
docker run -e SCREEPS_MOD_CLIENT_MOUNT_PATH=/play \
           -e SCREEPS_MOD_CLIENT_ROOT_REDIRECT=false \
           screeps/private-server
```

## How it works

The mod resolves the client bundle from its [`screeps-client`](../screeps-client) dependency at runtime — no separate build step is needed. The bundle is built with `base=/client/`, so the mount path must match.
