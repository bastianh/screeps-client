---
"screeps-connectivity": minor
"screeps-client": patch
---

Send the shard with flag-name lookups. `genUniqueFlagName()` and `checkUniqueFlagName()` now take an optional `shard`, and the client passes the shard of the room being viewed. Without it, official multi-shard servers rejected both calls with `invalid shard`, so the flag form could not generate or validate a name.

`addGlobalIntent()`, `setNotifyWhenAttacked()`, `createInvader()` and `removeInvader()` gained the same optional `shard` argument — the official client sends one on all four, and they were previously unusable on multi-shard servers for the same reason.

`tick()` also takes an optional `shard`, and with one it queries the official server's per-shard route `/api/game/shards/tick` instead of the shardless `/api/game/tick`, which only private servers provide. Calls without a shard are unchanged.
