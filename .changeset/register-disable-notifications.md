---
'screeps-connectivity': minor
'screeps-client': minor
---

Add a "Disable email notifications" checkbox to the OAuth registration form (Steam, Discord, ...). Mirrors the official client's registration option, but instead of dropping the email entirely it posts `{ disabled: true }` to `/api/user/notify-prefs` right after `set-username`, so the address stays on the account for login/recovery while notification emails are off from day one. `setNotifyPrefsWithToken` is exported from screeps-connectivity for bare-token use before a client session exists; the call is best-effort and never blocks the login.
