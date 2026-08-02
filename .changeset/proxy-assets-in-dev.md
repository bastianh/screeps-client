---
"screeps-client": patch
"screeps-client-proxy": patch
---

Let server-hosted `/assets` requests through to the backend: the Vite dev server proxies `/assets` to `VITE_PROXY_TARGET`, and `screeps-client-proxy` forwards wrapped `/assets` paths instead of falling through to the SPA. Assets now load in dev and behind the proxy the same way they do when the client is served by the backend itself.
