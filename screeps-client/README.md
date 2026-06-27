# screeps-client

Browser client for [Screeps](https://screeps.com) private servers. Built with [SolidJS](https://solidjs.com) and [PixiJS](https://pixijs.com).

This package contains the compiled client bundle. To serve it on your server, install one of the mod packages instead of using this package directly:

| Server | Mod package |
|---|---|
| [screeps/private-server](https://github.com/screeps/screeps) | [`screepsmod-client-new`](https://www.npmjs.com/package/screepsmod-client-new) |
| [xxscreeps](https://github.com/laverdet/xxscreeps) | [`xxscreeps-mod-client`](https://www.npmjs.com/package/xxscreeps-mod-client) |

---

## Features

- **Room view** — terrain, structures, creeps with smooth movement, Screeps visuals, attack/heal animations
- **World map** — minimap tiles, owner badges, minerals, reservation/RCL overlay, room tooltip
- **Console** — live output with input, log filtering, auto-scroll
- **Code editor** — CodeMirror-based branch editor
- **Account** — overview page (GCL/GPL rings, stats), per-room minimap previews, power creeps
- **Market** — all orders, my orders, and transaction history
- Supports `screepsmod-auth` (password, Steam, GitHub, GitLab) and guest/read-only access (xxscreeps)

---

## Development

```sh
# from repo root
pnpm install
pnpm dev        # starts the Vite dev server for screeps-client
```

The dev server proxies API requests to a real Screeps server — configure the target in `screeps-client/vite.config.ts`.

`screeps-connectivity` is a workspace dependency with a `"development"` export condition pointing at its TypeScript source, so you **don't** need to build it before running `pnpm dev`.

### Build

```sh
pnpm build            # build connectivity, then the client
```

Individual build targets inside `screeps-client/`:

```sh
pnpm build                      # standard browser bundle
pnpm build:embedded             # embedded bundle at /client/ (for screepsmod-client-new)
pnpm build:embedded:xxscreeps   # embedded bundle for xxscreeps-mod-client
pnpm build:all                  # all three
```

### Lint / test

```sh
pnpm lint
pnpm test
```

---

## Repository

This package is part of the [`screeps-client`](https://github.com/bastianh/screeps-client) monorepo.

---

## License

ISC
