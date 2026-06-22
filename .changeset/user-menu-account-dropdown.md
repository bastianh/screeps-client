---
"screeps-client": minor
"screeps-connectivity": minor
---

Replace the top-right logout button with a username chip (badge + name) that opens an account dropdown. The dropdown holds Settings, Respawn (with a destructive confirmation dialog), Change/Set password, and Logout. Password management works for email/password and Steam sessions — Steam-only accounts without a password get a "Set password" flow — while pasted API-token and guest sessions hide it. Settings now opens from the dropdown (guests keep the header gear); the panel's existing close button is the only toggle. Trimmed the Settings panel of options already available directly in the room/map views (creep labels, map view options) and removed the "Verbose creep details" toggle — the body-part breakdown is now always shown.

`screeps-connectivity`: `UserInfo` gains an optional `password?: boolean` field, surfaced from `/api/auth/me`, indicating whether the account has a password set.
