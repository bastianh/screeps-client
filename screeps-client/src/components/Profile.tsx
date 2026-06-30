import { createResource, For, Show } from 'solid-js'
import { X } from 'lucide-solid'
import { OverlayPage } from '~/components/OverlayPage.js'
import type { ApiLeaderboardFindResponse } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { profileUsername, goToGame, goToRoom, goToUser } from '~/stores/routeStore.js'
import { RankRing, GCL_RING, GCL_TEXT, GPL_RING, GPL_TEXT } from '~/components/RankRing.js'
import { PlayerBadge } from '~/components/PlayerBadge.js'
import { RoomPreviewTile } from '~/components/RoomPreviewTile.js'
import { StatTileRow, totalsFromStats } from '~/components/AccountStatTiles.js'
import { extractOwnedRooms } from '~/utils/ownedRooms.js'
import { gclProgress, gplProgress, type LevelProgress } from '~/utils/levels.js'

// Public account dashboard for any player, keyed by username — the same layout
// as the self Overview (GCL/GPL rings, stat tiles, owned-room minimaps) plus the
// leaderboard "current month" ranks, fed from the public endpoints:
//   find(username) → {_id, gcl, power, badge}; rooms(_id); stats(_id); leaderboard.
const PANEL = '#161b22'
const BORDER = '#30363d'
const TEXT = '#c9d1d9'
const MUTED = '#8b949e'
const GOLD = '#d9b54a'
const RED = '#C54444'

// The official client's "Last 7 days" stat interval (its dropdown maps 8 → 1 hour,
// 180 → 24 hours, 1440 → 7 days); the tiles sum this window.
const STAT_INTERVAL = 1440

function currentSeason(): string {
  // Seasons roll over at UTC, so derive the YYYY-MM id in UTC — a non-UTC client
  // near a month boundary would otherwise request the wrong (empty) season.
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Servers return either a single season record at the top level or a one-element
// list; normalize to { rank (0-based, null when unranked), score }.
function rankRecord(res: ApiLeaderboardFindResponse | null): { rank: number | null; score: number } {
  const rec = res?.list?.[0] ?? res
  const rank = typeof rec?.rank === 'number' ? rec.rank : null
  const score = typeof rec?.score === 'number' ? rec.score : 0
  return { rank, score }
}

const rankLabel = (rank: number | null) => (rank == null ? '—' : `#${(rank + 1).toLocaleString()}`)
const scoreLabel = (score: number) => score.toLocaleString()

function RankTile(props: { l1: string; l2: string; value: string; accent: string }) {
  return (
    <div style={{ flex: 1, 'min-width': '0', background: PANEL, border: `1px solid ${props.accent}`, 'border-radius': '6px', padding: '12px 8px', 'text-align': 'center' }}>
      <div style={{ color: props.accent, 'font-size': '11px', 'text-transform': 'uppercase', 'line-height': '1.3' }}>
        {props.l1}<br />{props.l2}
      </div>
      <div style={{ color: props.accent, 'font-size': '22px', 'font-weight': 300, 'margin-top': '8px' }}>{props.value}</div>
    </div>
  )
}

export function Profile() {
  const [user] = createResource(
    () => profileUsername(),
    async (username) => {
      const c = client()
      if (!c) return null
      try {
        const res = await c.http.user.find({ username })
        return res.user ?? null
      } catch {
        // Unknown username / lookup failure → render the not-found state.
        return null
      }
    },
  )

  const userId = () => user()?._id

  // Owned rooms for the minimap grid (public, keyed by user id).
  const [rooms] = createResource(userId, async (id) => {
    const c = client()
    if (!c) return []
    try {
      return extractOwnedRooms(await c.http.user.rooms(id))
    } catch {
      return []
    }
  })

  // "Last 7 days" tiles — public stats summed into the totals shape.
  const [totals] = createResource(userId, async (id) => {
    const c = client()
    if (!c) return null
    try {
      return totalsFromStats(await c.http.user.stats(STAT_INTERVAL, id))
    } catch {
      return null
    }
  })

  // "Current month" leaderboard ranks (by username): world = expansion + control
  // points, power = power rank + points. Best-effort; empty servers render —.
  const [ranks] = createResource(
    () => (user() ? user()!.username : undefined),
    async (username) => {
      const c = client()
      if (!c) return null
      const season = currentSeason()
      const [world, power] = await Promise.all([
        c.http.leaderboard.find(username, 'world', season).catch(() => null),
        c.http.leaderboard.find(username, 'power', season).catch(() => null),
      ])
      return { world: rankRecord(world), power: rankRecord(power) }
    },
  )

  const gclProg = (): LevelProgress => gclProgress(user()?.gcl ?? 0)
  const gplProg = (): LevelProgress => gplProgress(user()?.power ?? 0)
  const fraction = (p: LevelProgress) => (p.total > 0 ? p.current / p.total : 0)
  const tooltip = (p: LevelProgress) => `Next level: ${Math.floor(p.current).toLocaleString()} / ${Math.floor(p.total).toLocaleString()}`

  return (
    <OverlayPage>
        <Show when={!user.loading} fallback={<div style={{ color: MUTED, 'text-align': 'center', padding: '60px' }}>Loading…</div>}>
          <Show
            when={user()}
            fallback={
              <div style={{ 'text-align': 'center', padding: '60px' }}>
                <div style={{ color: MUTED, 'font-size': '18px', 'margin-bottom': '16px' }}>User not found</div>
                <button onClick={goToGame} style={{ padding: '7px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}>
                  Back to the world
                </button>
              </div>
            }
          >
            {(u) => (
              <>
                {/* Header: identity + GCL/GPL rings */}
                <div style={{ display: 'flex', 'align-items': 'center', gap: '16px', background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '6px', padding: '16px 20px', 'margin-bottom': '16px' }}>
                  <PlayerBadge badge={u().badge} size={48} />
                  <h1 style={{ margin: 0, 'font-size': '24px', 'font-weight': 600, color: '#ffd479' }}>{u().username}</h1>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={goToUser}
                    title="Your own overview"
                    style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', 'font-size': '13px' }}
                  >
                    My overview
                  </button>
                  <RankRing value={gclProg().level} label="GCL" ring={GCL_RING} text={GCL_TEXT} fraction={fraction(gclProg())} tooltip={tooltip(gclProg())} />
                  <RankRing value={gplProg().level} label="GPL" ring={GPL_RING} text={GPL_TEXT} fraction={fraction(gplProg())} tooltip={tooltip(gplProg())} />
                  <button
                    onClick={goToGame}
                    title="Close"
                    style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Current month — leaderboard ranks */}
                <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '10px' }}>Current month</div>
                <div style={{ display: 'flex', gap: '10px', 'margin-bottom': '24px' }}>
                  <RankTile l1="Expansion" l2="rank" accent={GOLD} value={rankLabel(ranks()?.world.rank ?? null)} />
                  <RankTile l1="Control" l2="points" accent={GOLD} value={scoreLabel(ranks()?.world.score ?? 0)} />
                  <RankTile l1="Power" l2="rank" accent={RED} value={rankLabel(ranks()?.power.rank ?? null)} />
                  <RankTile l1="Power" l2="points" accent={RED} value={scoreLabel(ranks()?.power.score ?? 0)} />
                </div>

                {/* Last 7 days — stat tiles */}
                <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '10px' }}>Last 7 days</div>
                <StatTileRow totals={totals()} />

                {/* Owned-room minimaps */}
                <Show when={rooms()?.length}>
                  <div style={{ 'margin-top': '24px' }}>
                    <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '12px' }}>Rooms</div>
                    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '16px' }}>
                      <For each={rooms()}>
                        {(r) => <RoomPreviewTile room={r.room} shard={r.shard} ownerId={u()._id} onClick={() => goToRoom(r.room, r.shard)} />}
                      </For>
                    </div>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
    </OverlayPage>
  )
}
