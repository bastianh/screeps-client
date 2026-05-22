# xxscreeps-mod-client

## 0.2.1

### Patch Changes

- d0af12a: Lazy-load the code editor and map viewer panels, and split `pixi.js` and CodeMirror into dedicated vendor chunks. Reduces the initial download by ~36% (319 kB → 204 kB gzipped) and fully defers CodeMirror until the code panel is opened. The mod packages re-ship the new client bundle.
- 98bea3e: Mark `express` (in `screepsmod-client-new`) and `xxscreeps` (in `xxscreeps-mod-client`) as optional peer dependencies, and disable pnpm's `auto-install-peers` for the workspace. Prevents the legacy `xxscreeps@0.1.0` dep tree (jquery, angular, lodash, koa, webpack, …) from being installed during development, which removes ~30 transitive vulnerabilities from the lockfile. The mods still require their host frameworks at runtime — that requirement is unchanged.
