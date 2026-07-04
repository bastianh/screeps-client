---
"screeps-client": patch
---

Fix Tauri desktop login/logout edge cases: ignore stale `server:disconnected`/`server:error` events that arrive after the client was already replaced (e.g. leaving guest mode), and always clear the stored auto-connect session token on logout, even for token-based logins, so a subsequent launch doesn't silently reconnect.
