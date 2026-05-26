---
title: Screeps Client Monorepo Overview
type: note
permalink: screeps-client/project/screeps-client-monorepo-overview
tags:
- monorepo
- architecture
- overview
---

# Screeps Client Monorepo Overview

A pnpm workspace containing four published npm packages plus a `docs/` tree and a `reference/` directory of older Screeps client implementations kept for historical context. All four packages publish to npm under the `bastianh` GitHub user and use changesets for versioning. CI handles all publishing — no manual `pnpm publish`.

The root `pnpm dev` delegates to the `screeps-client` Vite dev server. `pnpm build` builds `screeps-connectivity` first (tsup), then `screeps-client` (tsc + vite). Tests live only in `screeps-connectivity/` and run with Vitest.

## Packages at a glance

| Package dir | npm name | Role | Type |
|---|---|---|---|
| `screeps-connectivity/` | `screeps-connectivity` | Core TS library: HTTP + WebSocket + stores | Zero-dep ESM+CJS |
| `screeps-client/` | `screeps-client` | SolidJS + PixiJS browser frontend | Browser ESM |
| `screeps-mod-client/` | `screepsmod-client-new` | Screeps server mod (Express) | CJS |
| `xxscreeps-mod-client/` | `xxscreeps-mod-client` | xxscreeps mod (Koa hooks) | ESM |

## Dependency graph

```
screeps-connectivity   (no prod deps)
       ↑
screeps-client         (workspace:*)
       ↑
screeps-mod-client     (workspace:^)
xxscreeps-mod-client   (workspace:^)
```

`screeps-client` lists `screeps-connectivity` as a `devDependency` with a `"development"` export condition pointing to raw TS source, so the library build is not needed during `pnpm dev`.

## Versioning rules

- patch — bug fixes, internal refactors, doc-only changes
- minor — new public API, additive features
- major — breaking API changes
- Adding a changeset for `screeps-client` auto-generates a companion changeset with patch bumps for both mod packages via a local changeset wrapper script.

## Key docs

- `docs/claude/connectivity.md` — screeps-connectivity architecture for AI context
- `docs/claude/client.md` — screeps-client architecture for AI context
- `docs/claude/workflow.md` — PR, changeset and release flow
- `docs/screeps-connectivity.md` — full public API reference

## Observations
- [convention] CLAUDE.md mandates using codebase-index MCP tools first, before Grep/Read, for code exploration
- [convention] TypeScript strict mode, ESM, 2-space indent, no semicolons, named exports, explicit `.js` extensions in TS specifiers
- [convention] `~/` path alias maps to `screeps-client/src/`
- [status] Four packages all currently published; no internal-only packages

## Relations
- contains [[screeps-connectivity Library]]
- contains [[screeps-client Frontend]]
- contains [[screepsmod-client-new Server Mod]]
- contains [[xxscreeps-mod-client Mod]]
