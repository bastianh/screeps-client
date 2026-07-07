---
"screeps-client": minor
---
Add a top-level Messages screen with per-user conversation deep links. Messages now lives at `/messages` (moved out from under the User hub), and a specific conversation is deep-linkable at `/messages/<username>` — resolving the username to the user id for the message list/send endpoints, with browser back/forward support. Other players' profile pages gain a "Message" button (on messaging-capable servers) that opens the conversation with them, complete with the send box. The User overview's Mail button now navigates to the new route.
