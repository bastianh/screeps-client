---
"screeps-connectivity": patch
---

Guard against null or missing `objects` field in room update messages, and catch listener errors in `SocketClient.emit` so a bad listener cannot trigger a fatal socket error and kick the user out.
