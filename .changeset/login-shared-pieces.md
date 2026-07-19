---
"screeps-client": patch
---

Deduplicate the two login screens: `components/login/shared.tsx` now holds the input styles, the password/token toggle, the server-password field, the error line, the connect button, the Steam/Discord buttons, and the shared server-capability probes (`serverHasSteam`, `serverHasDiscord`, `serverShowsServerPassword`). `LoginForm` and `DesktopLoginForm` consume these instead of carrying parallel copies. No behavior change.
