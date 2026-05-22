---
"screeps-client": patch
---

In dev mode, default the login form's server URL to `window.location.origin` instead of a hard-coded `http://localhost:21025`. This makes the Vite proxy (`/api`, `/socket` → `VITE_PROXY_TARGET`) the default path for local development, regardless of which port Vite picks.
