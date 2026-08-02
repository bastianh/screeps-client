import { createEffect, createResource, createSignal, For, Show } from 'solid-js'
import { X, Mail } from 'lucide-solid'
import { OverlayPage } from '~/components/OverlayPage.js'
import { client, userInfo, isPrivateServer } from '~/stores/clientStore.js'
import { allianceForUser, hexColor, loadAlliances } from '~/stores/allianceStore.js'
import { capabilities } from '~/stores/capabilities.js'
import { profileUsername, goToGame, goToRoom, goToRoomOverview, goToUser, goToMessagesUser } from '~/stores/routeStore.js'
import { GCL_RING, GCL_TEXT, GPL_RING, GPL_TEXT } from '~/components/RankRing.js'
import { PlayerBadge } from '~/components/PlayerBadge.js'
import { RoomPreviewTile } from '~/components/RoomPreviewTile.js'
import { StatTileRow, totalsFromStats } from '~/components/AccountStatTiles.js'
import { LeaderboardRankTiles } from '~/components/leaderboard/RankTiles.js'
import { extractOwnedRooms, groupRoomsByShard } from '~/utils/ownedRooms.js'
import { gclProgress, gplProgress, type LevelProgress } from '~/utils/levels.js'

// Public account dashboard for any player, keyed by username — the same layout
// as the self Overview (GCL/GPL rings, stat tiles, owned-room minimaps) plus the
// leaderboard "current month" ranks, fed from the public endpoints:
//   find(username) → {_id, gcl, power, badge}; rooms(_id); stats(_id); leaderboard.
const PANEL = '#161b22'
const BORDER = '#30363d'
const TEXT = '#c9d1d9'
const MUTED = '#8b949e'

// The official client's stat-window dropdown: 8 → 1 hour, 180 → 24 hours,
// 1440 → 7 days. The tiles sum whichever window is selected.
const STAT_INTERVALS = [
  { value: 8, label: 'Last 1 hour' },
  { value: 180, label: 'Last 24 hours' },
  { value: 1440, label: 'Last 7 days' },
] as const

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

  // The LOAN roster only describes the official MMO, so it stays unrequested on a
  // private server. Elsewhere a profile view is reason enough to fetch it — the
  // store dedupes and caches, so this is at most one request per 6h.
  createEffect(() => {
    if (isPrivateServer() !== true) void loadAlliances()
  })

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

  const roomsByShard = () => groupRoomsByShard(rooms() ?? [])

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
                  {/* Alliance chip — same colour the world map tints their rooms with. */}
                  <Show when={allianceForUser(u().username)}>
                    {(a) => (
                      <span
                        title={a().name}
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          'border-radius': '10px',
                          border: `1px solid ${hexColor(a().color)}`,
                          background: `${hexColor(a().color)}22`,
                          color: TEXT,
                          'font-size': '12px',
                          'font-weight': 600,
                          'white-space': 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            'border-radius': '2px',
                            background: hexColor(a().color),
                            flex: '0 0 auto',
                          }}
                        />
                        {a().abbreviation}
                      </span>
                    )}
                  </Show>
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

                {/* Current month — leaderboard ranks, click through to the table */}
                <LeaderboardRankTiles username={u().username} />

                {/* Stat tiles — interval picked from the dropdown */}
                <select
                  value={statInterval()}
                  onChange={(e) => setStatInterval(Number(e.currentTarget.value))}
                  style={{ padding: '4px 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: PANEL, color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', cursor: 'pointer', 'margin-bottom': '10px' }}
                >
                  <For each={STAT_INTERVALS}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
                <StatTileRow totals={totals()} />

                {/* Owned-room minimaps, grouped by shard */}
                <Show when={rooms()?.length}>
                  <div style={{ 'margin-top': '24px' }}>
                    <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '12px' }}>Rooms</div>
                    <For each={roomsByShard()}>
                      {([shard, list]) => (
                        <div style={{ 'margin-bottom': '20px' }}>
                          <Show when={shard}>
                            <div style={{ color: TEXT, 'font-size': '13px', 'font-weight': 600, 'margin-bottom': '10px' }}>{shard}</div>
                          </Show>
                          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '16px' }}>
                            <For each={list}>
                              {(r) => <RoomPreviewTile room={r.room} shard={r.shard} ownerId={u()._id} onClick={() => goToRoom(r.room, r.shard)} onOverview={() => goToRoomOverview(r.room, r.shard)} />}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
    </OverlayPage>
  )
}
