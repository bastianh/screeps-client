# Repository Guidelines

## Project Structure & Module Organization
This repository currently centers on the `screeps-connectivity/` package. Keep production code in `screeps-connectivity/src/` and group it by concern: `http/`, `socket/`, `storage/`, `stores/`, `cache/`, and `types/`. Put tests in `screeps-connectivity/tests/`, mirroring the source layout where possible, for example `src/socket/SocketClient.ts` and `tests/socket/SocketClient.test.ts`. Build output goes to `screeps-connectivity/dist/` and should be treated as generated artifacts.

## Build, Test, and Development Commands
Run commands from `screeps-connectivity/`.

- `npm run build` bundles the library with `tsup` and emits declarations to `dist/`.
- `npm test` runs the full Vitest suite once.
- `npm run test:watch` starts Vitest in watch mode for local development.
- `npm run lint` runs ESLint against `src` and `tests`.

Example:

```sh
cd screeps-connectivity
npm run lint && npm test
```

## Coding Style & Naming Conventions
The codebase uses TypeScript with ESM, strict compiler settings, and ESLint 9 plus `@typescript-eslint`. Follow the existing style: 2-space indentation, semicolon-free statements, named exports, and explicit `.js` import specifiers in TypeScript source. Use `PascalCase` for classes (`ScreepsClient.ts`), `camelCase` for functions and variables, and keep files focused on a single responsibility.

## Testing Guidelines
Vitest is the test runner and uses the Node environment. Add tests for every behavioral change and prefer colocated naming by feature, ending with `.test.ts`. Mirror source paths under `tests/` and cover both success paths and edge cases such as auth failures, socket disconnects, or storage fallbacks. Run `npm test` before opening a PR; use `npm run test:watch` while iterating.

## Commit & Pull Request Guidelines
Git history is minimal (`initial commit`), so use short, imperative commit subjects going forward, for example `Add token refresh handling`. Keep commits scoped to one change. Pull requests should include a clear summary, note any API or behavior changes, link related issues, and include test evidence (`npm test`, `npm run lint`). Add sample payloads or logs when changing HTTP or socket behavior.

## Generated Files & Dependencies
Do not hand-edit `screeps-connectivity/dist/`. Prefer changes in `src/` and rebuild. Avoid committing incidental edits under `node_modules/`; treat it as local-only workspace state.
