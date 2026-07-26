import { createEffect, createMemo, createResource, createSignal, For, Show, type JSX } from 'solid-js'
import { X, Search, Trophy, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-solid'
import { currentLeaderboardSeason, normalizeLeaderboardRank, type ApiLeaderboardUser } from 'screeps-connectivity'
import { OverlayPage } from '~/components/OverlayPage.js'
import { PlayerBadge } from '~/components/PlayerBadge.js'
import { client, isGuest, userInfo } from '~/stores/clientStore.js'
import { goToGame, goToLeaderboard, goToProfile, leaderboardTarget } from '~/stores/routeStore.js'
import { BG, PANEL, PANEL_RAISED, BTN, BORDER, TEXT, MUTED, DIM } from '~/components/theme.js'
import { LEADERBOARD_MODES, modeInfo, seasonLabel } from './modes.js'

// The world ranking tables, mirroring the official client's Expansion Rank and
// Power Rank lobby pages: a season picker, your own placement, a name search
// that jumps to a player's page, and the paged table itself.
//
// Rows are paged server-side (offset/limit) and `rank` is 0-based throughout the
// API, so every rendered rank is `rank + 1`.

const PAGE_SIZE = 20
// How many numbered page buttons flank the current one.
const PAGE_SPAN = 2

interface Season {
  _id: string
  name: string
}

export function Leaderboard() {
  const info = () => modeInfo(leaderboardTarget().mode)

  // Season list. Servers that don't keep seasons (most private ones) answer
  // nothing usable — fall back to the month currently being ranked so the page
  // still works against a bare /leaderboard/list implementation.
  const [seasons] = createResource(async (): Promise<Season[]> => {
    const c = client()
    const fallback: Season[] = [{ _id: currentLeaderboardSeason(), name: seasonLabel(currentLeaderboardSeason()) }]
    if (!c) return fallback
    try {
      const res = await c.http.leaderboard.seasons()
      const list = (res.seasons ?? []).map((s) => ({ _id: s._id, name: s.name || seasonLabel(s._id) }))
      return list.length ? list : fallback
    } catch {
      return fallback
    }
  })

  // The season being shown: the URL's, else the newest one the server reports.
  const season = () => leaderboardTarget().season ?? seasons()?.[0]?._id ?? currentLeaderboardSeason()

  // Entering without a page means "put me where the interesting row is": the
  // searched/linked player, or the logged-in player's own rank (what the
  // official client does). Replaces the history entry so Back still leaves the
  // page in one press. Keyed so it runs once per table/season/target.
  // Tracks the lookup in flight so a re-run (say, userInfo arriving) doesn't
  // fire a second request for the same target; cleared on settle, since landing
  // here again with no page is a genuinely new intent.
  let jumpInFlight = ''
  createEffect(() => {
    if (!seasons()) return
    const t = leaderboardTarget()
    if (t.page != null) return
    const who = t.highlight ?? (isGuest() ? null : userInfo()?.username ?? null)
    const key = `${t.mode}|${season()}|${who ?? ''}`
    if (jumpInFlight === key) return
    jumpInFlight = key

    const c = client()
    if (!who || !c) {
      jumpInFlight = ''
      goToLeaderboard({ page: 1 }, true)
      return
    }
    void c.http.leaderboard
      .find(who, t.mode, season())
      .then(normalizeLeaderboardRank)
      .then((r) => goToLeaderboard({ page: r ? pageOfRank(r.rank) : 1, highlight: r ? who : null }, true))
      .catch(() => goToLeaderboard({ page: 1 }, true))
      .finally(() => { jumpInFlight = '' })
  })

  const page = () => leaderboardTarget().page ?? 1

  const [table] = createResource(
    () => (seasons() ? { mode: leaderboardTarget().mode, season: season(), page: page() } : null),
    async ({ mode, season: s, page: p }) => {
      const c = client()
      if (!c) return null
      return c.http.leaderboard.list({ mode, season: s, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE })
    },
  )

  // Your own placement in the table on show — the "your rank" chip.
  const [myRank] = createResource(
    () => (isGuest() || !userInfo()?.username || !seasons() ? null : { username: userInfo()!.username, mode: leaderboardTarget().mode, season: season() }),
    async ({ username, mode, season: s }) => {
      const c = client()
      if (!c) return null
      return c.http.leaderboard.find(username, mode, s).then(normalizeLeaderboardRank).catch(() => null)
    },
  )

  const rows = () => table()?.list ?? []
  const users = (): Record<string, ApiLeaderboardUser> => table()?.users ?? {}
  const pageCount = () => Math.max(1, Math.ceil((table()?.count ?? 0) / PAGE_SIZE))
  // An empty season and a server without rankings look alike in the data, so
  // only a hard error gets the "no leaderboard here" copy. 'unresolved' covers
  // the window before the season list settles and the first request goes out.
  const failed = () => table.state === 'errored' || (table.state === 'ready' && table() === null)
  const pending = () => table.state === 'unresolved' || table.state === 'pending' || table.state === 'refreshing'

  const pageNumbers = createMemo(() => {
    const first = Math.max(1, Math.min(page() - PAGE_SPAN, pageCount() - PAGE_SPAN * 2))
    const last = Math.min(pageCount(), Math.max(page() + PAGE_SPAN, PAGE_SPAN * 2 + 1))
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  })

  // Name search — resolves the player's rank and jumps to the page holding it.
  const [search, setSearch] = createSignal('')
  const [searching, setSearching] = createSignal(false)
  const [searchError, setSearchError] = createSignal<string | null>(null)

  const submitSearch = (e: Event): void => {
    e.preventDefault()
    const name = search().trim()
    const c = client()
    if (!name || !c) return
    setSearching(true)
    setSearchError(null)
    void c.http.leaderboard
      .find(name, leaderboardTarget().mode, season())
      .then(normalizeLeaderboardRank)
      .then((r) => {
        if (!r) {
          setSearchError(`${name} is not ranked this season.`)
          return
        }
        goToLeaderboard({ page: pageOfRank(r.rank), highlight: name })
      })
      .catch(() => setSearchError(`Couldn't look up ${name}.`))
      .finally(() => setSearching(false))
  }

  const highlighted = (username: string | undefined) =>
    username != null && username.toLowerCase() === leaderboardTarget().highlight?.toLowerCase()

  return (
    <OverlayPage>
      {/* Section header */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '8px' }}>
        <Trophy size={20} color={info().accent} />
        <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>Leaderboard</h1>
        <div style={{ flex: 1 }} />
        <Show when={myRank()}>
          {(r) => (
            <button
              onClick={() => goToLeaderboard({ page: pageOfRank(r().rank), highlight: userInfo()?.username ?? null })}
              title="Show your row"
              style={{
                display: 'flex', 'align-items': 'baseline', gap: '8px', padding: '5px 12px', 'border-radius': '8px',
                border: `2px solid ${info().accent}`, background: 'transparent', cursor: 'pointer',
              }}
            >
              <span style={{ color: info().accent, 'font-size': '11px', 'font-weight': 600, 'letter-spacing': '0.5px' }}>YOUR RANK</span>
              <span style={{ color: info().accent, 'font-size': '18px', 'font-weight': 700, 'line-height': '1' }}>{r().rank + 1}</span>
            </button>
          )}
        </Show>
        <button
          onClick={goToGame}
          title="Close"
          style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: BTN, color: TEXT, cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Table tabs */}
      <div style={{ display: 'flex', gap: '4px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '16px' }}>
        <For each={LEADERBOARD_MODES}>
          {(m) => (
            <Tab
              label={m.label}
              accent={m.accent}
              active={leaderboardTarget().mode === m.mode}
              onClick={() => goToLeaderboard({ mode: m.mode, page: null })}
            />
          )}
        </For>
      </div>

      <div style={{ color: MUTED, 'font-size': '13px', 'line-height': '1.5', 'margin-bottom': '16px' }}>
        {info().description} Ranks reset at the end of the month.
      </div>

      {/* Season picker + name search */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '16px', 'flex-wrap': 'wrap' }}>
        <label style={{ display: 'flex', 'align-items': 'center', gap: '8px', color: MUTED, 'font-size': '13px' }}>
          Season
          <select
            value={season()}
            onChange={(e) => goToLeaderboard({ season: e.currentTarget.value, page: null })}
            style={{ padding: '6px 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: PANEL, color: TEXT, cursor: 'pointer' }}
          >
            <For each={seasons() ?? []}>{(s) => <option value={s._id}>{s.name}</option>}</For>
          </select>
        </label>
        <form onSubmit={submitSearch} style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '0 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: BG }}>
            <Search size={14} color={MUTED} />
            <input
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search by name"
              style={{ padding: '6px 0', border: 'none', background: 'transparent', color: TEXT, 'font-size': '13px', outline: 'none', width: '160px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!search().trim() || searching()}
            style={{
              padding: '6px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: BTN,
              color: search().trim() ? TEXT : DIM, cursor: search().trim() && !searching() ? 'pointer' : 'default', 'font-size': '13px',
            }}
          >
            {searching() ? 'Finding…' : 'Find'}
          </button>
        </form>
        <Show when={searchError()}>
          <span style={{ color: MUTED, 'font-size': '13px' }}>{searchError()}</span>
        </Show>
      </div>

      <Show
        when={!failed()}
        fallback={
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
            Couldn't load the leaderboard — this server may not keep one.
          </div>
        }
      >
        <Show
          when={rows().length}
          fallback={
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
              {pending() ? 'Loading…' : 'No results yet.'}
            </div>
          }
        >
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '13px', opacity: table.loading ? 0.6 : 1 }}>
              <thead>
                <tr style={{ color: MUTED }}>
                  <th style={{ 'text-align': 'right', 'font-weight': 400, padding: '11px 16px', 'border-bottom': `1px solid ${BORDER}`, width: '80px' }}>Rank</th>
                  <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '11px 0', 'border-bottom': `1px solid ${BORDER}` }}>Player</th>
                  <th style={{ 'text-align': 'right', 'font-weight': 400, padding: '11px 16px', 'border-bottom': `1px solid ${BORDER}` }}>{info().scoreLabel}</th>
                </tr>
              </thead>
              <tbody>
                <For each={rows()}>
                  {(row, i) => {
                    const user = () => users()[row.user]
                    const isHit = () => highlighted(user()?.username)
                    return (
                      <tr
                        style={{
                          background: isHit() ? `${info().accent}22` : i() % 2 === 1 ? PANEL_RAISED : 'transparent',
                          'box-shadow': isHit() ? `inset 3px 0 0 ${info().accent}` : 'none',
                        }}
                      >
                        <td style={{ 'text-align': 'right', color: isHit() ? info().accent : MUTED, 'font-variant-numeric': 'tabular-nums', 'font-weight': isHit() ? 600 : 400, padding: '9px 16px' }}>
                          {row.rank + 1}
                        </td>
                        <td style={{ padding: '9px 0' }}>
                          <Show when={user()} fallback={<span style={{ color: DIM }}>—</span>}>
                            {(u) => (
                              <span
                                onClick={() => goToProfile(u().username)}
                                style={{ display: 'inline-flex', 'align-items': 'center', gap: '8px', color: TEXT, cursor: 'pointer' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#58a6ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT)}
                              >
                                <PlayerBadge badge={u().badge} size={20} />
                                {u().username}
                              </span>
                            )}
                          </Show>
                        </td>
                        <td style={{ 'text-align': 'right', color: TEXT, 'font-variant-numeric': 'tabular-nums', padding: '9px 16px' }}>
                          {Math.round(row.score).toLocaleString()}
                        </td>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>

          <Show when={pageCount() > 1}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', gap: '4px', 'margin-top': '16px' }}>
              <PageButton title="First page" disabled={page() <= 1} onClick={() => goToLeaderboard({ page: 1 })}><ChevronsLeft size={14} /></PageButton>
              <PageButton title="Previous page" disabled={page() <= 1} onClick={() => goToLeaderboard({ page: page() - 1 })}><ChevronLeft size={14} /></PageButton>
              <For each={pageNumbers()}>
                {(n) => (
                  <PageButton title={`Page ${n}`} active={n === page()} accent={info().accent} onClick={() => goToLeaderboard({ page: n })}>
                    {n}
                  </PageButton>
                )}
              </For>
              <PageButton title="Next page" disabled={page() >= pageCount()} onClick={() => goToLeaderboard({ page: page() + 1 })}><ChevronRight size={14} /></PageButton>
              <PageButton title="Last page" disabled={page() >= pageCount()} onClick={() => goToLeaderboard({ page: pageCount() })}><ChevronsRight size={14} /></PageButton>
            </div>
            <div style={{ 'text-align': 'center', color: DIM, 'font-size': '12px', 'margin-top': '8px' }}>
              {(table()?.count ?? 0).toLocaleString()} ranked players
            </div>
          </Show>
        </Show>
      </Show>
    </OverlayPage>
  )
}

// 0-based rank → the 1-based page holding it.
function pageOfRank(rank: number): number {
  return Math.floor(rank / PAGE_SIZE) + 1
}

function Tab(props: { label: string; accent: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={() => props.onClick()}
      style={{
        padding: '8px 16px',
        border: 'none',
        'border-bottom': `2px solid ${props.active ? props.accent : 'transparent'}`,
        background: 'transparent',
        color: props.active ? TEXT : MUTED,
        'font-size': '14px',
        'font-weight': props.active ? 600 : 400,
        cursor: 'pointer',
        'margin-bottom': '-1px',
      }}
    >
      {props.label}
    </button>
  )
}

function PageButton(props: { title: string; disabled?: boolean; active?: boolean; accent?: string; onClick: () => void; children: JSX.Element }): JSX.Element {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={() => props.onClick()}
      style={{
        'min-width': '32px',
        height: '30px',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: '0 8px',
        'border-radius': '4px',
        border: `1px solid ${props.active ? (props.accent ?? BORDER) : BORDER}`,
        background: props.active ? `${props.accent ?? BORDER}22` : BTN,
        color: props.disabled ? DIM : props.active ? (props.accent ?? TEXT) : TEXT,
        cursor: props.disabled ? 'default' : 'pointer',
        'font-size': '13px',
        'font-variant-numeric': 'tabular-nums',
      }}
    >
      {props.children}
    </button>
  )
}
