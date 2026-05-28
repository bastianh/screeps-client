---
"screeps-client": patch
---

Use relative base path (`./`) for the xxscreeps embedded build so that asset references in `index.html` resolve relative to the served page URL. This ensures assets under `_client/` are requested at the correct subpath (e.g. `/client/_client/...`) regardless of where the mod mounts the client.
