---
"xxscreeps-mod-client": patch
---

Inject `<base href="<mountPath>/">` into served HTML so relative asset URLs resolve from the mount root rather than the current SPA route. Without this, reloading at a sub-path like `/room/E11N2` caused the browser to fetch scripts from `/room/_client/…` instead of `/_client/…`.
