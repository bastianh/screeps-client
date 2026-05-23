---
name: changeset
description: >
  Smart changeset creator for pnpm/changesets monorepos. Use this skill whenever
  the user says "changeset", "add changeset", "/changeset", "release note", or
  asks to document their changes for a release. Also trigger when they finish a
  feature or fix and ask "what's next" or "ready to PR" and no changeset exists
  yet. This skill analyzes the current branch diff, maps changes to the right
  packages, recommends a semver bump level, and writes the .changeset/*.md file
  — without touching the interactive CLI.
---

# Changeset Skill

You're helping the user add a changeset to a pnpm workspace that uses
[Changesets](https://github.com/changesets/changesets) for versioning and
publishing.

## Package map

This repo has four published packages. Map changed file paths to package names:

| Directory prefix        | Package name (in changeset frontmatter) |
|------------------------|------------------------------------------|
| `screeps-connectivity/` | `"screeps-connectivity"`                |
| `screeps-client/`       | `"screeps-client"`                      |
| `screeps-mod-client/`   | `"screepsmod-client-new"`               |
| `xxscreeps-mod-client/` | `"xxscreeps-mod-client"`               |

Changes to root-level files (`.github/`, `.changeset/`, `pnpm-workspace.yaml`,
etc.) don't belong to any published package and don't need a changeset.

## Step 1 — Discover what changed

Run these two commands from the repo root:

```bash
git diff main...HEAD --name-only
```

```bash
ls .changeset/*.md 2>/dev/null | xargs grep -l '"' 2>/dev/null || true
```

From the first command, determine which of the four packages have changed files.
From the second, read each existing `.changeset/*.md` file's YAML frontmatter
to see which packages are already covered by a pending changeset. **Skip any
package that already has a pending changeset** — you only need to fill the gaps.

If every affected package is already covered, tell the user and stop (nothing to
do).

## Step 2 — Analyse the diff for bump level

For each package that still needs a changeset, read the diff for its directory:

```bash
git diff main...HEAD -- <directory>/
```

Decide on a semver bump:

- **major** — breaking change to the public API (removed export, changed
  function signature, renamed type that consumers use)
- **minor** — new public API surface added (new exported function, new option,
  new store event) while keeping everything backwards-compatible
- **patch** — bug fix, internal refactor, dependency update, build/config
  change, docs; also the default for `screeps-client` and the two mod packages
  since they don't expose a library API

When in doubt, patch. The mod packages and `screeps-client` are almost always
patch.

## Step 3 — Ask the user to confirm

Use `AskUserQuestion` to present your findings and let the user adjust before
writing anything. Show:

- Which packages you're adding to the changeset and at what bump level
- A one-line description you drafted for the changeset body (they can edit it)

Keep it short — one question with the proposed packages/levels, one for the
description if they want to change it.

## Step 4 — Write the changeset file

Pick a short, descriptive kebab-case slug (2–3 words summarising the change,
e.g. `embedded-base-path`, `fix-socket-reconnect`, `add-leaderboard-api`).

Write `.changeset/<slug>.md`:

```
---
"package-name": patch
"other-package": minor
---

One or two sentences describing what changed and why it matters to consumers.
```

- The frontmatter is YAML; each line is `"package-name": bump-level`.
- The body is plain Markdown — no heading, just a concise description.
- Use the package names from the map above (the npm package names, not the
  directory names).

## Step 5 — Offer to stage and commit

Ask the user if they want to `git add .changeset/<slug>.md` and commit it now,
or leave it unstaged. If they say yes, commit it with a short message like
`chore: add changeset for <slug>`.

## What not to do

- Don't run `pnpm changeset` (interactive CLI — won't work non-interactively).
- Don't add packages that weren't actually modified on this branch.
- Don't add a changeset for a package that already has one pending.
- Don't write a major bump for `screeps-client` or mod packages without
  explicit confirmation — they don't have a library API to break.
