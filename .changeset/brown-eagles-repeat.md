---
'screeps-client': minor
---

Add the decoration inventory page at `/inventory`.

Lists every decoration the account owns with its preview, rarity and type, filterable by type,
theme and target room, and sortable new/old, rare/common or grouped by room. Activated items link
straight to the room they sit in.

The nav entry appears only when the server advertises the `inventory` feature in `/api/version`,
which is the same gate the reference client uses — private servers without decorations keep the
section hidden.

Placing and removing decorations is not wired up yet; this view is read-only.
