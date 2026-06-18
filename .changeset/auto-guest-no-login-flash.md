---
"screeps-client": minor
---

Start directly in guest mode without flashing the login screen. When the client knows at boot that it will auto-connect — embedded xxscreeps mode (guest), a `?guest=` param, or a returning user with a stored token — it now shows a lightweight connecting splash instead of the `LoginForm` until the connection settles. The login form is only shown once the auto-connect attempt fails or when there is nothing to auto-connect.
