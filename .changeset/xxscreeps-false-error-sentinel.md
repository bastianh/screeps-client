---
"screeps-connectivity": patch
---

Accept the xxscreeps `{ error: "actually, it was fine" }` sentinel (returned with status 200 on endpoints like `create-construction` to work around an official-client bug) as a successful response instead of throwing.
