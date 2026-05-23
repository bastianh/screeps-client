---
name: pre-pr
description: >
  Full pre-PR checklist for this pnpm monorepo: lint, test, changeset
  validation, then open the GitHub PR. Use this skill whenever the user says
  "pre-pr", "/pre-pr", "open pr", "create pr", "prepare PR", "ready to merge",
  or "ship this". Also trigger when they ask "is everything ready?" or "can I
  open a PR?" after finishing work on a branch. Runs all quality gates in the
  right order so nothing gets missed.
---

# Pre-PR Skill

Work through these steps in order. Show the output of each step. **Stop and
report if any step fails** — don't continue to the next step with broken output.

## Step 1 — Lint

```bash
pnpm lint
```

Run from the repo root. Warnings are fine; errors are a blocker. If there are
errors, show them and stop — ask the user to fix them first.

## Step 2 — Test

```bash
pnpm test
```

Run from the repo root. A single test failure is a blocker. Show any failures
and stop if they exist.

## Step 3 — Changeset status

```bash
pnpm exec changeset status
```

Show the full output so the user can see what's pending.

Then check whether any packages with changes on this branch are **missing** a
changeset. Use the same logic as the `changeset` skill:

**Package map:**

| Directory prefix        | Package name                  |
|------------------------|-------------------------------|
| `screeps-connectivity/` | `"screeps-connectivity"`      |
| `screeps-client/`       | `"screeps-client"`            |
| `screeps-mod-client/`   | `"screepsmod-client-new"`     |
| `xxscreeps-mod-client/` | `"xxscreeps-mod-client"`      |

Run:
```bash
git diff main...HEAD --name-only
```

Cross-reference the changed packages against the packages already listed in any
`.changeset/*.md` frontmatter on this branch.

**If packages are missing a changeset**, ask the user what they'd like to do:

1. **Create one now** — follow the `changeset` skill's logic inline (analyse
   diff → suggest bump → write the file)
2. **Skip versioning** — run `pnpm changeset --empty` to record that this
   change intentionally ships without a version bump
3. **Abort** — the user wants to handle it manually before continuing

Don't proceed to Step 4 until the changeset situation is resolved.

## Step 4 — Open the PR

Ask the user for:
- A short PR title (under 70 characters)
- Any detail they want in the body, or say "generate it"

If they say "generate it", draft the body yourself based on `git log
main...HEAD` and `git diff main...HEAD --stat`. Use this structure:

```markdown
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] Lint passes
- [ ] Tests pass
- [ ] Changeset added (if applicable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Then create the PR:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Return the PR URL to the user when done.

## Tips

- If the branch has no commits ahead of main yet, tell the user — there's
  nothing to PR.
- If the user is already on a PR branch that was pushed, `gh pr create` will
  fail. In that case use `gh pr edit` to update title/body instead.
- The changeset check is advisory for `screeps-client`-only changes (internal
  frontend, not published as a library), but surface it anyway so the user can
  decide consciously.
