---
'screeps-client': patch
---

Keep the CodeMirror bundle off the first load — it is roughly 162 kB gzip that no longer blocks
startup.

The three editor panels (script, segments, custom UI) were already `lazy()`, but the `vendor-codemirror`
manual chunk also claimed `solid-codemirror`, which pulled solid-js in with it. Since the whole app
needs solid-js, the entry chunk ended up statically importing the vendor chunk and `index.html`
preloaded it, so every visitor paid for CodeMirror whether or not they opened an editor. Leaving
`solid-codemirror` unassigned keeps solid-js in the eager graph and CodeMirror behind the dynamic
imports it belongs to.
