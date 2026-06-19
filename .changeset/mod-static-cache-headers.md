---
"screepsmod-client-new": patch
"xxscreeps-mod-client": patch
---

Send explicit `Cache-Control` headers for the embedded client's static assets.
Content-hashed files under `_client/` are served `immutable` (cacheable for a
year); everything else — `index.html`, `themes/`, and other non-hashed `public/`
assets — is served `no-cache` so browsers revalidate and pick up updated files
(e.g. the sprite atlas `test.json`) instead of serving a stale cached copy.
Previously no cache headers were set, so browsers cached these stable-URL assets
heuristically and could keep stale frames after a spritesheet update.
