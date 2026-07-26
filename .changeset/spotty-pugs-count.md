---
'screeps-connectivity': minor
'screeps-client': minor
---

Add the world and power leaderboards.

**screeps-client** — a new Leaderboard page (`/leaderboard/<mode>`) reachable from
the header, modeled on the official client's Expansion Rank and Power Rank lobby
pages: season picker, paged ranking table with badges linking through to player
profiles, a name search that jumps to a player's page, and a "your rank" chip.
Opening it without a page lands on the row of the player you're looking for —
yours, or the one you searched or linked to. The account Overview and public
Profile pages now show clickable current-month rank tiles that open the table on
that row.

**screeps-connectivity** — `http.leaderboard.list()` now takes an options object
(`{ mode, season, limit, offset }`) instead of four positional arguments,
`seasons()` accepts an optional mode, and `find()` omits `season` rather than
sending an empty one so it returns every ranked season. All three routes are
silent, since not every private server keeps ranking tables. Adds the
`currentLeaderboardSeason()` and `normalizeLeaderboardRank()` helpers plus
`LeaderboardMode`, `ApiLeaderboardEntry` and `ApiLeaderboardUser` types.
