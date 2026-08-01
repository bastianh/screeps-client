---
'screeps-client': patch
---

Drop solid-devtools and ship Solid's production runtime.

The devtools are no longer used, so the `solid-devtools/vite` plugin, the `@solid-devtools/debugger`
setup import in `index.tsx` and both dev dependencies are gone. With them goes
`resolve.conditions: ['development']`, which was there to force Solid's `development` export for the
debugger — it applied to production builds too, so releases shipped `solid-js/dist/dev.js` and the
matching dev builds of `solid-js/web` and `solid-js/store`, with their warning paths and reactive
bookkeeping. Builds now resolve `solid.js` / `web.js` / `store.js`.

The dev server is unaffected: vite-plugin-solid adds the `development` condition itself when the
command is `serve`.
