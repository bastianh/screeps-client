---
"screeps-connectivity": minor
"screeps-client": minor
---

Tell shards apart in the console

The `user:<id>/console` channel is not shard-scoped: output from every shard a player
runs on arrives interleaved on one channel, with only a `shard` field on the frame to
separate the streams. That field was being dropped, so a player active on several shards
saw three log streams mixed together with nothing to tell them apart.

`ConsoleMessage` now carries `shard` and `receivedAt`, and `UserStore` exposes
`consoleBacklog()` — a snapshot of the rolling buffer, so a console view mounted
mid-session opens with the output so far instead of an empty pane.

The console panel builds on that:

- Every line is prefixed with its arrival time and a colour-coded `[shardN]` tag; clicking
  a tag filters the pane to that shard, and the tag is part of what the regex filter matches.
- Sent commands are echoed into the results pane with the shard they went to, so a result
  can be attributed to the command that produced it.
- A shard picker at the prompt targets commands at a shard other than the one being viewed;
  it defaults to the viewed shard and resets when you navigate elsewhere.
- Popout windows now open with the main window's console backlog.
- Fixed: commands were sent with `shard=shard0` on servers that have no shards at all.
