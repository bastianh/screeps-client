---
"screeps-connectivity": patch
"screeps-client": patch
---

Don't show the "Connection lost" modal after an intentional disconnect. A guest hitting Login (or any user logging out) tore the session down synchronously, but the socket's async `onclose` still fired `server:disconnected` with `willReconnect: false`, which re-raised a fatal session error over the login screen. The disconnected event now carries an `intentional` flag so the client can distinguish a user-initiated close from a genuinely lost connection.
