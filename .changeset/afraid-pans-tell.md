---
'screeps-client': patch
---

Fix moving an already-placed decoration failing with "Decoration already activated".

The server rejects `activate` on a decoration that is already active, so editing one now takes it
down first — the same two-step the reference client performs behind its "back edit" button. Because
that leaves a moment where the decoration sits nowhere, a failure in the second step says the old
placement is gone instead of reading as if nothing happened.
