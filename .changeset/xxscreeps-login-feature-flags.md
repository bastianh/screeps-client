---
"screeps-connectivity": minor
"screeps-client": patch
"xxscreeps-mod-client": minor
---

xxscreeps-mod-client now publishes an `xxscreeps-mod-client` server feature at `/api/version` reflecting `.screepsrc.yaml`'s `backend.allowGuestAccess`, `backend.allowEmailRegistration`, and `backend.steamApiKey`. screeps-client reads this via the new `getXxscreepsModClientFeature` helper (screeps-connectivity) to show or hide the Guest, "Create account", and "Login with Steam" options to match what the server actually allows, instead of guessing.
