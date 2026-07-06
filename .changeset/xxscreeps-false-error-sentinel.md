---
"screeps-connectivity": patch
---

Accept the xxscreeps `{ error: "actually, it was fine" }` sentinel (returned with status 200 by the `create-construction` route to signal success) as a successful response instead of throwing.
