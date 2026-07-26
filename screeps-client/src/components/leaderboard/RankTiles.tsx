import { createResource, For, Show } from 'solid-js'
import { currentLeaderboardSeason, normalizeLeaderboardRank, type LeaderboardRank } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { goToLeaderboard } from '~/stores/routeStore.js'
import { PANEL, MUTED } from '~/components/theme.js'
import { LEADERBOARD_MODES, seasonLabel } from './modes.js'

// The "current month" ranking summary shown on a player's account page: for each
// ranking table, their placement and their score. Clicking a tile opens the
// Leaderboard on that table, on the page holding their row.
//
// Best-effort — servers without ranking tables answer nothing and every tile
// reads "—". Pass `hideWhenUnranked` on pages that shouldn't show an all-dashes
// row (the self Overview); the public Profile keeps them for layout stability.

const rankLabel = (r: LeaderboardRank | null) => (r ? `#${(r.rank + 1).toLocaleString()}` : '—')
const scoreLabel = (r: LeaderboardRank | null) => (r ? Math.round(r.score).toLocaleString() : '—')

function RankTile(props: { l1: string; l2: string; value: string; accent: string; onClick?: () => void }) {
  const clickable = () => props.onClick != null
  return (
    <div
      onClick={() => props.onClick?.()}
      title={clickable() ? 'Show in the leaderboard' : undefined}
      style={{
        flex: 1, 'min-width': '0', background: PANEL, border: `1px solid ${props.accent}`,
        'border-radius': '6px', padding: '12px 8px', 'text-align': 'center',
        cursor: clickable() ? 'pointer' : 'default',
      }}
    >
      <div style={{ color: props.accent, 'font-size': '11px', 'text-transform': 'uppercase', 'line-height': '1.3' }}>
        {props.l1}<br />{props.l2}
      </div>
      <div style={{ color: props.accent, 'font-size': '22px', 'font-weight': 300, 'margin-top': '8px' }}>{props.value}</div>
    </div>
  )
}

export function LeaderboardRankTiles(props: { username: string | undefined; hideWhenUnranked?: boolean }) {
  const season = currentLeaderboardSeason()

  const [ranks] = createResource(
    () => props.username,
    async (username) => {
      const c = client()
      if (!c) return null
      const results = await Promise.all(
        LEADERBOARD_MODES.map((m) =>
          c.http.leaderboard.find(username, m.mode, season)
            .then(normalizeLeaderboardRank)
            .catch(() => null),
        ),
      )
      return new Map(LEADERBOARD_MODES.map((m, i) => [m.mode, results[i]]))
    },
  )

  const rankFor = (mode: (typeof LEADERBOARD_MODES)[number]['mode']) => ranks()?.get(mode) ?? null
  const anyRanked = () => LEADERBOARD_MODES.some((m) => rankFor(m.mode) != null)
  // Once loaded, an all-unranked result means the server has no ranking data for
  // this player (or no leaderboard at all) — the caller may prefer no row to a
  // row of dashes.
  const visible = () => !props.hideWhenUnranked || ranks.loading || anyRanked()

  return (
    <Show when={visible()}>
      <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '10px' }}>
        Current month — {seasonLabel(season)}
      </div>
      <div style={{ display: 'flex', gap: '10px', 'margin-bottom': '24px' }}>
        <For each={LEADERBOARD_MODES}>
          {(m) => {
            const open = () => goToLeaderboard({ mode: m.mode, season, page: null, highlight: props.username ?? null })
            return (
              <>
                <RankTile l1={m.label} l2="rank" accent={m.accent} value={rankLabel(rankFor(m.mode))} onClick={open} />
                <RankTile l1={m.scoreLabel.replace(/ points$/, '')} l2="points" accent={m.accent} value={scoreLabel(rankFor(m.mode))} onClick={open} />
              </>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
