---
"screeps-connectivity": minor
"screeps-client": patch
---

Fix Steam login failing with "auth failed" on brand-new accounts (e.g. xxscreeps). Some servers hand back a provisional token for a first-time OAuth signup that can't authenticate the websocket until a username is chosen; the login flow now detects this via `/api/auth/me` and prompts for a username before connecting. Adds `fetchAuthMeWithToken` and `completeProviderRegistration` to `screeps-connectivity`.
