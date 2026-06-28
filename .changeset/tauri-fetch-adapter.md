---
"screeps-connectivity": minor
"screeps-client": patch
---

Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.
