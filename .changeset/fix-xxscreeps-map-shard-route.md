---
"xxscreeps-mod-client": patch
---

Fix 404 on reload of `/map/<shard>` SPA routes. `/map/` was in the default
exclude list, so when the client is mounted at root the mod handed those paths
straight to xxscreeps (which has no `/map/` HTTP route) instead of serving the
SPA. Removed `/map/` from `DEFAULT_EXCLUDES`; the existing await-next()-then-404
fallback still leaves any real server route untouched.
