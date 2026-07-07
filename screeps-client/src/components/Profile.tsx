import { createResource, createSignal, For, Show } from 'solid-js'
import { X, Mail } from 'lucide-solid'
import { OverlayPage } from '~/components/OverlayPage.js'
import type { ApiLeaderboardFindResponse } from 'screeps-connectivity'
import { client, userInfo } from '~/stores/clientStore.js'
import { capabilities } from '~/stores/capabilities.js'
import { profileUsername, goToGame, goToRoom, goToUser, goToMessagesUser } from '~/stores/routeStore.js'
import { GCL_RING, GCL_TEXT, GPL_RING, GPL_TEXT } from '~/components/RankRing.js'
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

// The official client's stat-window dropdown: 8 → 1 hour, 180 → 24 hours,
// 1440 → 7 days. The tiles sum whichever window is selected.
const STAT_INTERVALS = [
  { value: 8, label: 'Last 1 hour' },
  { value: 180, label: 'Last 24 hours' },
  { value: 1440, label: 'Last 7 days' },
] as const

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

// Compact header GCL/GPL readout — a thick rounded chip bordered in the rank
// color (the ring color), with the brighter text color for the number/label.
function RankStat(props: { label: string; value: number; color: string; border: string; tooltip: string }) {
  return (
    <div
      title={props.tooltip}
      style={{
        display: 'flex', 'align-items': 'baseline', gap: '6px', 'flex-shrink': '0',
        padding: '5px 12px', 'border-radius': '8px', border: `2px solid ${props.border}`,
      }}
    >
      <span style={{ color: props.color, 'font-size': '11px', 'font-weight': 600, 'letter-spacing': '0.5px' }}>{props.label}</span>
      <span style={{ color: props.color, 'font-size': '18px', 'font-weight': 700, 'line-height': '1' }}>{props.value}</span>
    </div>
  )
}

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

  // Stat tiles — public stats summed into the totals shape, over the interval
  // picked in the dropdown. Refetches when either the user or interval changes.
  const [statInterval, setStatInterval] = createSignal<number>(1440)
  const [totals] = createResource(
    () => {
      const id = userId()
      return id ? ({ id, interval: statInterval() } as const) : null
    },
    async ({ id, interval }) => {
      const c = client()
      if (!c) return null
      try {
        return totalsFromStats(await c.http.user.stats(interval, id))
      } catch {
        return null
      }
    },
  )

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

  // Whether this public profile is the logged-in player's own account — drives
  // the shortcut link over to their private overview.
  const isOwnProfile = () => {
    const me = userInfo()?.username?.toLowerCase()
    const name = user()?.username?.toLowerCase()
    return !!me && me === name
  }

  const gclProg = (): LevelProgress => gclProgress(user()?.gcl ?? 0)
  const gplProg = (): LevelProgress => gplProgress(user()?.power ?? 0)
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
                {/* Header — mirrors the self Overview chrome: badge, name as title,
                    compact GCL/GPL readout, close. */}
                <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '24px' }}>
                  <PlayerBadge badge={u().badge} size={28} />
                  <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>{u().username}</h1>
                  <Show when={isOwnProfile()}>
                    <span
                      title="Your account overview"
                      onClick={goToUser}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#58a6ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
                      style={{ color: MUTED, cursor: 'pointer', 'font-size': '13px' }}
                    >
                      Overview
                    </span>
                  </Show>
                  <div style={{ flex: 1 }} />
                  <RankStat label="GCL" value={gclProg().level} color={GCL_TEXT} border={GCL_RING} tooltip={tooltip(gclProg())} />
                  <RankStat label="GPL" value={gplProg().level} color={GPL_TEXT} border={GPL_RING} tooltip={tooltip(gplProg())} />
                  {/* Message this player — only for other accounts on messaging-capable servers. */}
                  <Show when={!isOwnProfile() && capabilities().hasMessaging}>
                    <button
                      onClick={() => goToMessagesUser(u().username)}
                      title={`Message ${u().username}`}
                      style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '7px 12px', 'border-radius': '4px', border: '1px solid #388bfd', background: '#1f3158', color: '#58a6ff', cursor: 'pointer', 'font-size': '13px', 'margin-left': '6px' }}
                    >
                      <Mail size={14} /> Message
                    </button>
                  </Show>
                  <button
                    onClick={goToGame}
                    title="Close"
                    style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer', 'margin-left': '6px' }}
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

                {/* Stat tiles — interval picked from the dropdown */}
                <select
                  value={statInterval()}
                  onChange={(e) => setStatInterval(Number(e.currentTarget.value))}
                  style={{ padding: '4px 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: PANEL, color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', cursor: 'pointer', 'margin-bottom': '10px' }}
                >
                  <For each={STAT_INTERVALS}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
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
