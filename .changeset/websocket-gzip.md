---
"screeps-connectivity": minor
---

WebSocket compression support (opt-in): setting the new `ScreepsClientOptions.gzip` to `true` sends `gzip on` after auth, so the server deflates event frames (room updates, map stats, memory) and only transmits the compressed `gz:` form when it's actually smaller. Defaults to `false` to match the official client, which never enables it. The `gz:` decode path is always active regardless, so this is a pure opt-in bandwidth trade with no downside on small control frames.
