---
"screeps-client": minor
---

Refactor top-level navigation to use an overlay system: overview, profile, market, and settings now slide over the game canvas (preserving map position/zoom) instead of replacing the full page. Adds a shared `OverlayPage` template component. The map button moves into the room view as a floating corner button. Badge picker is accessible directly from the user menu dropdown.
