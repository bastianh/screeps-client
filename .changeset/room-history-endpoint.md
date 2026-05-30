---
"screeps-connectivity": minor
"screeps-client": patch
---

Add `http.game.roomHistory(room, time, shard?)` to `GameEndpoints` — handles both official server (path-based URL) and private server (query-param URL) automatically. `HistoryPlayer` in `screeps-client` is refactored to use this endpoint instead of a raw `fetch()` with manual token injection.
