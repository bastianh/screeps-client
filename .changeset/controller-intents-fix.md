---
"screeps-client": patch
---

Fix unclaim, activateSafeMode and suicide buttons: all three sent an empty intent and a missing/undefined room. Now correctly sends room (currentRoom()), shard and intent: { id } as the official client does. Fix controller badge not updating when the room owner changes: the visual is now rebuilt whenever the owner field changes so the inner circle style and badge appear/disappear correctly.
