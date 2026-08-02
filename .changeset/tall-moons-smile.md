---
'screeps-client': patch
---

Group the player profile's owned rooms by shard.

The public profile listed every room in one flat grid, so on a multishard server a player's rooms
from different shards sat side by side with nothing to tell them apart. They are now grouped under a
shard heading, the same as the account overview already did. Single-shard servers still render one
unlabeled grid.
