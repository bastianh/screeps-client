---
'screeps-client': minor
---

Add an alliance overlay to the world map, backed by the League of Automated Nations roster.

A fourth overlay mode next to Owner / Mineral / None — on the official server only, since the
roster describes nobody on a private one — tints each owned room in its alliance's colour and
stamps the abbreviation along the room's bottom edge. Owner badges stay visible, so the tint
says which alliance and the badge still says which player. The sidebar gains a colour legend
while the mode is active, listing each alliance's rooms in the current viewport and sorted by
them, so panning tells you who actually holds the region you're looking at. The room info box
shows the owner's alliance for hover and selection regardless of overlay mode, and a player's
profile page carries an alliance chip next to their name.

The roster comes from `leagueofautomatednations.com/alliances.js`, fetched lazily the first
time the overlay is selected — never for users who don't ask for it — and cached in
`localStorage` for 6h, with a stale cache used as a fallback when the network fails. The feed
ships `#000000` as the colour for every alliance, so colours are derived locally by hashing the
abbreviation into a fixed palette, which keeps them stable across sessions.
