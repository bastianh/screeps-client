import { createEffect, createSignal, onCleanup, onMount, For, Show, Switch, Match } from 'solid-js'
import { X, Zap, Mail } from 'lucide-solid'
import type { ApiUserOverviewTotals, ApiPowerCreep } from 'screeps-connectivity'
import { client, userInfo } from '~/stores/clientStore.js'
import { goToGame, goToRoom, goToUser, goToUserPower, goToUserPowerNew, goToUserPowerCreep, userView, powerView, powerCreepId } from '~/stores/routeStore.js'
import { Messages } from '~/components/Messages.js'
import { RankRing, GCL_RING, GCL_TEXT, GPL_RING, GPL_TEXT } from '~/components/RankRing.js'
import { PlayerBadge } from '~/components/PlayerBadge.js'
import { RoomPreviewTile } from '~/components/RoomPreviewTile.js'
import { StatTileRow } from '~/components/AccountStatTiles.js'
import { OverlayPage } from '~/components/OverlayPage.js'
import { extractOwnedRooms, type OwnedRoom } from '~/utils/ownedRooms.js'
import { gclProgress, gplProgress, gplLevel, type LevelProgress } from '~/utils/levels.js'
import { freePowerLevels } from '~/data/powerCreeps.js'
import { PowerCreepList } from '~/components/power/PowerCreepList.js'
import { PowerCreepDetail } from '~/components/power/PowerCreepDetail.js'
import { PowerCreepCreate } from '~/components/power/PowerCreepCreate.js'
import type { PowerContext, PowerNav } from '~/components/power/PowerCreeps.js'

// Vanilla refetches the overview (and re-reads the account record) on a 60s
// timer rather than via a socket subscription; mirror that cadence.
const REFRESH_MS = 60_000
// Stat interval in tick-buckets; 8 ≈ the vanilla "1 hour" default. statName only
// drives the (deferred) per-room punch-card, so any valid value works here.
const STAT_INTERVAL = 8

// App chrome (matches the Dashboard / GitHub-dark palette used across the site).
const PANEL = '#161b22'
const BORDER = '#30363d'
const TEXT = '#c9d1d9'
const MUTED = '#8b949e'

export function Overview() {
  const [showMessages, setShowMessages] = createSignal(false)
  const [totals, setTotals] = createSignal<ApiUserOverviewTotals | null>(null)
  const [rooms, setRooms] = createSignal<OwnedRoom[]>([])

  // Fetch the owned-room list once the user id is available. Read reactively
  // (not once in onMount) so this doesn't depend on auth resolving before mount;
  // the guard makes it fire exactly once, retrying only on error.
  let roomsRequested = false
  createEffect(() => {
    const c = client()
    const uid = userInfo()?._id
    if (!c || !uid || roomsRequested) return
    roomsRequested = true
    void c.http.user.rooms(uid)
      .then((res) => setRooms(extractOwnedRooms(res)))
      .catch(() => { roomsRequested = false })
  })

  onMount(() => {
    const c = client()
    if (!c) return
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchOverview = () =>
      c.http.user.overview(STAT_INTERVAL, 'energyHarvested').then((res) => setTotals(res.totals ?? null))

    // Only start the poll after the first fetch succeeds: on servers that don't
    // implement /api/user/overview the request errors (and surfaces a toast), so
    // we render zeros and avoid repeating it — and the toast — every minute.
    void fetchOverview()
      .then(() => {
        timer = setInterval(() => {
          void c.stores.user.refreshMe().catch(() => {})
          void fetchOverview().catch(() => {})
        }, REFRESH_MS)
      })
      .catch(() => {})

    onCleanup(() => {
      if (timer) clearInterval(timer)
    })
  })

  const gclProg = (): LevelProgress => gclProgress(userInfo()?.gcl ?? 0)
  const gplProg = (): LevelProgress => gplProgress(userInfo()?.power ?? 0)
  const fraction = (p: LevelProgress) => (p.total > 0 ? p.current / p.total : 0)
  const tooltip = (p: LevelProgress) => `Next level: ${Math.floor(p.current).toLocaleString()} / ${Math.floor(p.total).toLocaleString()}`

  const cardStyle = {
    flex: 1,
    display: 'flex',
    'align-items': 'center',
    gap: '16px',
    background: PANEL,
    border: `1px solid ${BORDER}`,
    'border-radius': '6px',
    padding: '16px',
  }

  // Power creeps inline toggle — sub-view state is owned by the route store so
  // /user/power deep links and browser back/forward work correctly.
  const [creeps, setCreeps] = createSignal<ApiPowerCreep[]>([])
  const [powerLoading, setPowerLoading] = createSignal(false)

  const reloadCreeps = async () => {
    const c = client()
    if (!c) return
    const res = await c.http.game.powerCreeps.list()
    setCreeps(res.list ?? [])
  }

  // Fetch creep data whenever the power view becomes active.
  createEffect(() => {
    if (userView() !== 'power') return
    setPowerLoading(true)
    void reloadCreeps().finally(() => setPowerLoading(false))
    void client()?.stores.user.refreshMe().catch(() => {})
  })

  const togglePower = () => userView() === 'power' ? goToUser() : goToUserPower()

  const powerCtx: PowerContext = {
    creeps,
    free: () => freePowerLevels(userInfo()?.power, creeps()),
    gpl: () => gplLevel(userInfo()?.power ?? 0),
    reload: reloadCreeps,
  }

  const powerNav: PowerNav = {
    goToList: goToUserPower,
    goToNew: goToUserPowerNew,
    goToCreep: goToUserPowerCreep,
  }

  const title = () => {
    if (showMessages()) return 'Messages'
    if (userView() === 'power') return 'Power Creeps'
    return 'Overview'
  }

  return (
    <OverlayPage>
        {/* Header — this is the player's own account page, so it carries their identity. */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '24px' }}>
          <PlayerBadge badge={userInfo()?.badge} size={28} />
          <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>
            {title()}
          </h1>
          <span style={{ color: MUTED, 'font-size': '14px' }}>{userInfo()?.username}</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowMessages((v) => !v)}
            title={showMessages() ? 'Back to overview' : 'Messages'}
            style={{
              display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', cursor: 'pointer',
              border: showMessages() ? '1px solid #388bfd' : `1px solid ${BORDER}`,
              background: showMessages() ? '#1f3158' : '#21262d',
              color: showMessages() ? '#58a6ff' : TEXT,
            }}
          >
            <Mail size={16} />
          </button>
          <button
            onClick={togglePower}
            title={userView() === 'power' ? 'Back to Overview' : 'Manage Power Creeps'}
            style={{
              display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', cursor: 'pointer',
              border: userView() === 'power' ? '1px solid #C54444' : `1px solid ${BORDER}`,
              background: userView() === 'power' ? '#2d1a1a' : '#21262d',
              color: userView() === 'power' ? '#ffb7ba' : TEXT,
            }}
          >
            <Zap size={16} />
          </button>
          <button
            onClick={goToGame}
            title="Close"
            style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <Show when={showMessages()}>
          <Messages />
        </Show>

        <Show when={!showMessages()}>
          <Show
            when={userView() === 'power'}
            fallback={
              <>
                {/* GCL / GPL cards */}
                <div style={{ display: 'flex', gap: '16px', 'margin-bottom': '16px' }}>
                  <div style={cardStyle}>
                    <RankRing value={gclProg().level} label="GCL" ring={GCL_RING} text={GCL_TEXT} fraction={fraction(gclProg())} tooltip={tooltip(gclProg())} />
                    <div>
                      <div style={{ 'font-size': '16px', 'font-weight': 600, color: TEXT, 'margin-bottom': '6px' }}>Global Control Level</div>
                      {/* Vanilla labels this "Rooms" but renders the GCL level number; mirror it. */}
                      <div style={{ color: MUTED, 'font-size': '13px' }}>
                        <span>Rooms: <strong style={{ color: TEXT }}>{gclProg().level}</strong></span>
                        <span style={{ 'margin-left': '14px' }}>CPU: <strong style={{ color: TEXT }}>{userInfo()?.cpu ?? '—'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <RankRing value={gplProg().level} label="GPL" ring={GPL_RING} text={GPL_TEXT} fraction={fraction(gplProg())} tooltip={tooltip(gplProg())} />
                    <div>
                      <div style={{ 'font-size': '16px', 'font-weight': 600, color: TEXT, 'margin-bottom': '8px' }}>Global Power Level</div>
                      <button
                        onClick={togglePower}
                        title="Manage your power creeps"
                        style={{ padding: '5px 10px', 'border-radius': '4px', border: '1px solid #C54444', background: '#21262d', color: '#ffb7ba', 'font-size': '12px', cursor: 'pointer' }}
                      >
                        Manage Power Creeps
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lifetime stat tiles */}
                <StatTileRow totals={totals()} />

                {/* Owned-room minimaps */}
                <Show when={rooms().length}>
                  <div style={{ 'margin-top': '24px' }}>
                    <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'margin-bottom': '12px' }}>Rooms</div>
                    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '16px' }}>
                      <For each={rooms()}>
                        {(r) => <RoomPreviewTile room={r.room} shard={r.shard} onClick={() => goToRoom(r.room, r.shard)} />}
                      </For>
                    </div>
                  </div>
                </Show>
              </>
            }
          >
            <Switch>
              <Match when={powerView() === 'list'}>
                <PowerCreepList ctx={powerCtx} loading={powerLoading()} nav={powerNav} />
              </Match>
              <Match when={powerView() === 'new'}>
                <PowerCreepCreate ctx={powerCtx} nav={powerNav} />
              </Match>
              <Match when={powerView() === 'detail'}>
                <PowerCreepDetail ctx={powerCtx} id={powerCreepId()} nav={powerNav} />
              </Match>
            </Switch>
          </Show>
        </Show>
    </OverlayPage>
  )
}
