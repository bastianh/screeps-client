---
"screeps-connectivity": patch
"screeps-client": patch
---

Fix destroying roads and walls in the property viewer when the user owns the room.

Roads and walls carry no `user` field, so the destroy button was never shown.
The fix falls back to `roomOwner().userId` for ownerless structures and
correctly passes `room`, `roomName`, and an optional `shard` in the
`destroyStructure` intent — matching the format the official client sends.
`addObjectIntent` in `screeps-connectivity` now accepts an optional `shard`
parameter.
