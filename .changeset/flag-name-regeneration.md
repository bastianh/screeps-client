---
"screeps-client": patch
---

Keep the flag-creation name field stocked with a free name. After a flag is
created the draft name is regenerated via `gen-unique-flag-name`, retrying with
a short backoff so the server has time to register the new flag instead of
handing back the name just used. When re-entering flag mode, the existing draft
name is re-validated via `check-unique-flag-name` and regenerated if it has
since been taken.
