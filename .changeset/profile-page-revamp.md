---
"screeps-client": minor
"screeps-connectivity": patch
---

Revamp the public profile page (`/profile/<username>`):

- Header now mirrors the self Overview chrome — small badge, the player's name
  as the title, and a compact GCL/GPL readout rendered as rounded chips bordered
  in the rank color (teal / red).
- The "Last 7 days" stat block is now a dropdown (1 hour / 24 hours / 7 days);
  the tiles refetch the user's public stats for the selected window.
- Stat tiles now render correctly on servers that return `/api/user/stats`
  metrics as a single pre-summed total per interval, not just per-tick buckets
  (`ApiUserStatsResponse.stats` widened to `number | bucket[]`).
- Cross-links between the two account views: the username on the self Overview
  links to the public profile, and your own public profile links back to your
  private Overview.
- The top-bar Overview button no longer appears active while a profile is open —
  a profile is a separate view.
