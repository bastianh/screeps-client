---
"screeps-client": patch
---

Consolidate scattered isTauri/isEmbedded/isXxscreepsMode checks behind a single capabilities() interface, with hasMarket/hasMessaging placeholders for future server-feature gating; dedupe the pre-login server-info hook shared by LoginForm and DesktopLoginForm.
