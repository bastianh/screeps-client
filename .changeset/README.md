# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

## Adding a changeset

When your change affects one or more published packages, run:

```sh
pnpm changeset
```

The CLI will ask which packages changed and at what semver level (patch / minor / major), then write a markdown file into this folder. Commit it alongside your change.

In this repo, `pnpm changeset` is wrapped by `scripts/changeset-with-mod-sync.mjs`. The wrapper handles two automatic cascades:

- **connectivity → client**: when a new changeset includes `screeps-connectivity`, the wrapper creates `.changeset/screeps-connectivity-client-consumer.md` with a patch bump for `screeps-client`, unless `screeps-client` is already covered. (`screeps-connectivity` is a `devDependency` of `screeps-client`, so changesets won't cascade it automatically.)
- **client → mods**: when a new changeset includes `screeps-client` (directly or via the above cascade), the wrapper creates `.changeset/screeps-client-mod-consumers.md` with patch bumps for `screepsmod-client-new` and `xxscreeps-mod-client`, unless another pending changeset already covers both.

## How releases happen

`.github/workflows/release.yml` runs on every push to `main`:

- If unreleased changesets are present, the workflow opens (or updates) a **"chore: version packages"** PR that bumps versions in the affected `package.json` files and updates `CHANGELOG.md`.
- When that PR is merged, the same workflow runs `changeset publish`, which publishes any packages whose version is not yet on npm.

Pushes to `main` that contain no changesets are no-ops.

## Config

See `config.json` in this folder. Notable settings:

- `access: public` — all four workspace packages publish publicly.
- `updateInternalDependencies: patch` — when an internal `workspace:*` dep changes, the consuming package gets a patch bump.
- `baseBranch: main`.
