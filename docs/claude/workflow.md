---
title: workflow
type: note
permalink: screeps-client/claude/workflow
---

# Workflow — PRs, Testing, Releases

## Pull Requests

- Branch off `main`. One logical change per PR.
- Before opening: `pnpm lint` for every edited package; `pnpm test` (from `screeps-connectivity/`) if the library was touched.
- If the change affects a published package, **add a changeset in the same PR** — otherwise the change ships unversioned and never publishes.
- `gh pr create`, title under 70 chars, detail in body.

## Changesets

```sh
pnpm changeset                    # interactive: pick packages + semver level
pnpm changeset --empty            # record intentionally version-less change
pnpm exec changeset status        # show pending changesets + projected bumps
```

`pnpm changeset` is wrapped locally. If a newly created changeset includes `screeps-client`, the wrapper also creates or refreshes `.changeset/screeps-client-mod-consumers.md` with patch bumps for `screepsmod-client-new` and `xxscreeps-mod-client`, unless those packages are already covered by another pending changeset. Edit that generated file if the release note text should be more specific.

Bump rules:
- **patch** — bug fixes, internal refactors, doc-only changes
- **minor** — new public API surface, additive features
- **major** — breaking API changes

Internal `workspace:*` consumers get a patch bump automatically when an upstream version changes.

Do **not** hand-edit `version` fields in `package.json` — changesets owns them.

## Release flow (CI-driven)

On push to `main`:
1. Unreleased changesets exist → workflow opens/updates a **"chore: version packages"** PR (bumps versions + updates CHANGELOGs). Merge it to trigger publish.
2. No pending changesets → workflow builds all packages and runs `changeset publish` (only pushes versions not yet on npm).

Do **not** run `pnpm version-packages`, `pnpm release`, or `pnpm publish` locally — CI only.

`pnpm build:release` — locally reproduce the CI build pipeline (no publish).