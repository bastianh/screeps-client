---
"screeps-connectivity": patch
---

Fix `TokenAuth` always using its static token — server-issued `X-Token` headers, WebSocket token rotation, and the idle keep-alive timer are now skipped when the auth strategy sets `supportsTokenRefresh: false`.
