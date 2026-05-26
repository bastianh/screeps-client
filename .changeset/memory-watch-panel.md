---
"screeps-connectivity": minor
"screeps-client": minor
---

Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

`screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.
