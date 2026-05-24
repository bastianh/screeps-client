# CLAUDE.md

pnpm workspace — four published packages plus docs.

## Codebase Navigation — MANDATORY

You MUST use codebase-index MCP tools FIRST when exploring or navigating the codebase. This is not optional.

- ALWAYS start with: get_project_summary, find_symbol, get_function_source, get_class_source,
  get_structure_summary, get_dependencies, get_dependents, get_change_impact, get_call_chain, search_codebase
- Only fall back to Read/Glob/Grep when codebase-index tools genuinely don't have what you need
  (e.g. reading non-code files, config, frontmatter)
- If you catch yourself reaching for Glob/Grep/Read to find or understand code, STOP and use
  codebase-index instead

pnpm workspace — four published packages plus docs.

## Packages

| Directory | Published as | Role |
|---|---|---|
| `screeps-connectivity/` | `screeps-connectivity` | Core TS library: HTTP, WebSocket, stores, cache, storage. **→ read `docs/claude/connectivity.md`** |
| `screeps-client/` | `screeps-client` | SolidJS + PixiJS browser frontend. **→ read `docs/claude/client.md`** |
| `screeps-mod-client/` | `screepsmod-client-new` | Screeps server mod — serves embedded client at `/client` |
| `xxscreeps-mod-client/` | — | xxscreeps mod — serves and wires up embedded client |

Other: `docs/screeps-connectivity.md` (full API ref), `docs/superpowers/` (design specs — do not edit), `test-live.mjs` (ad-hoc integration test).

## Commands

```sh
# root
pnpm dev            # screeps-client dev server
pnpm build          # build connectivity then client
pnpm test           # screeps-connectivity tests
pnpm lint           # lint all packages

# screeps-connectivity/
pnpm build          # tsup → dist/
pnpm test           # Vitest single run
pnpm test:watch     # Vitest watch
npx vitest run tests/socket/SocketClient.test.ts

# screeps-client/
pnpm dev            # Vite dev server
pnpm build          # tsc + vite build
pnpm lint
```

## Coding conventions

- TypeScript strict, ESM, 2-space indent, no semicolons
- Named exports; explicit `.js` extensions in TS import specifiers
- `PascalCase` files/classes, `camelCase` functions/variables
- Zero production deps in `screeps-connectivity` — native platform APIs only
- Never edit `screeps-connectivity/dist/`
- Use `~/` alias for imports inside `screeps-client/src/`

## PRs & releases

→ See `docs/claude/workflow.md` for changeset rules, bump levels, and release flow.
