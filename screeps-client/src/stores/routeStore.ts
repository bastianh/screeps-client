import { createSignal } from 'solid-js'
import { basePath } from '~/utils/embedded.js'
import { buildRoomUrl, buildRoomOverviewUrl } from '~/utils/gameRoutes.js'

// Top-level screen the connected app shows. The in-game Dashboard owns its own
// /room and /map sub-routing; this store decides the User hub (/user) vs.
// Profile (public, any user) vs. Messages vs. Market vs. the game view.
export type Route = 'user' | 'profile' | 'game' | 'market' | 'messages' | 'room-overview' | 'leaderboard' | 'inventory'

// Target of the /room-overview/<shard>/<room> page: the room to show stats for,
// with its shard (null on single-shard servers where no shard segment is present).
export interface RoomOverviewTarget {
  room: string
  shard: string | null
}

// Sub-view within the User hub: the overview stats page or the power creeps
// manager. Exactly one is active at a time.
export type UserView = 'overview' | 'power'

// Sub-view within the Market section: the resource index (all-orders), a single
// resource's order book (resource), your own orders, or the credit history.
export type MarketView = 'all-orders' | 'resource' | 'my-orders' | 'history'

// Sub-view within the Power Creeps section (list / create / per-creep detail).
export type PowerView = 'list' | 'new' | 'detail'

// Which ranking table the Leaderboard shows. Mirrors the API's `mode`.
export type LeaderboardMode = 'world' | 'power'

// Everything the Leaderboard page reads out of the URL: the table, the season
// (null → whichever season the server is currently ranking), the 1-based page,
// and the username whose row should be highlighted (from "your rank" or search).
export interface LeaderboardTarget {
  mode: LeaderboardMode
  season: string | null
  page: number | null
  highlight: string | null
}

function userPath(): string {
  return `${basePath()}/user`
}

function userPrefix(): string {
  return `${basePath()}/user/`
}

function userPowerPath(): string {
  return `${basePath()}/user/power`
}

function userPowerPrefix(): string {
  return `${basePath()}/user/power/`
}

function messagesPath(): string {
  return `${basePath()}/messages`
}

function messagesPrefix(): string {
  return `${basePath()}/messages/`
}

function profilePrefix(): string {
  return `${basePath()}/profile/`
}

function roomOverviewPrefix(): string {
  return `${basePath()}/room-overview/`
}

function leaderboardPath(): string {
  return `${basePath()}/leaderboard`
}

function leaderboardPrefix(): string {
  return `${basePath()}/leaderboard/`
}

function inventoryPath(): string {
  return `${basePath()}/inventory`
}

function inventoryPrefix(): string {
  return `${basePath()}/inventory/`
}

function marketPath(): string {
  return `${basePath()}/market`
}

function marketPrefix(): string {
  return `${basePath()}/market/`
}

function currentPath(): string {
  return window.location.pathname + window.location.search + window.location.hash
}

function parseRoute(): Route {
  const p = window.location.pathname
  if (p === userPath() || p.startsWith(userPrefix())) return 'user'
  if (p.startsWith(profilePrefix())) return 'profile'
  if (p === messagesPath() || p.startsWith(messagesPrefix())) return 'messages'
  if (p === marketPath() || p.startsWith(marketPrefix())) return 'market'
  if (p === leaderboardPath() || p.startsWith(leaderboardPrefix())) return 'leaderboard'
  if (p === inventoryPath() || p.startsWith(inventoryPrefix())) return 'inventory'
  if (p.startsWith(roomOverviewPrefix())) return 'room-overview'
  return 'game'
}

// /leaderboard/<mode>?season=&page=&highlight= — the mode is a path segment
// (it's the identity of the table) while season/page/highlight are query params
// so paging and searching don't mint distinct-looking pages.
function parseLeaderboard(): LeaderboardTarget {
  const p = window.location.pathname
  const seg = p.startsWith(leaderboardPrefix()) ? decodeURIComponent(p.slice(leaderboardPrefix().length).split('/')[0]) : ''
  const params = new URLSearchParams(window.location.search)
  const page = Number(params.get('page'))
  return {
    mode: seg === 'power' ? 'power' : 'world',
    season: params.get('season'),
    page: Number.isInteger(page) && page > 0 ? page : null,
    highlight: params.get('highlight'),
  }
}

// { room, shard } for /room-overview/<shard>/<room> (or /room-overview/<room> on
// single-shard servers), or null when the path isn't a room-overview URL.
function parseRoomOverview(): RoomOverviewTarget | null {
  const p = window.location.pathname
  if (!p.startsWith(roomOverviewPrefix())) return null
  const parts = p.slice(roomOverviewPrefix().length).split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length >= 2) return { shard: parts[0], room: parts[1] }
  if (parts.length === 1) return { shard: null, room: parts[0] }
  return null
}

// The decoration whose editor is open, from /inventory/<itemId>. Keeping it in the URL
// means anything that can link — the room sidebar, for one — can open the editor without
// having to own the dialog or its data.
function parseInventoryItem(): string | null {
  const p = window.location.pathname
  if (!p.startsWith(inventoryPrefix())) return null
  const id = decodeURIComponent(p.slice(inventoryPrefix().length))
  return id || null
}

function parseUserView(): UserView {
  const p = window.location.pathname
  if (p === userPowerPath() || p.startsWith(userPowerPrefix())) return 'power'
  return 'overview'
}

// The conversation partner for /messages/<username>, or null for the inbox at
// /messages. The username is the source of truth; Messages resolves it to a
// user id for the list/send endpoints.
function parseMessagesUsername(): string | null {
  const p = window.location.pathname
  if (!p.startsWith(messagesPrefix())) return null
  const name = decodeURIComponent(p.slice(messagesPrefix().length))
  return name || null
}

function parseProfileUsername(): string | null {
  const p = window.location.pathname
  if (!p.startsWith(profilePrefix())) return null
  const name = decodeURIComponent(p.slice(profilePrefix().length))
  return name || null
}

function parseMarket(): { view: MarketView; resourceType: string | null } {
  const p = window.location.pathname
  if (p === `${marketPath()}/my`) return { view: 'my-orders', resourceType: null }
  if (p === `${marketPath()}/history`) return { view: 'history', resourceType: null }
  const resourcePrefix = `${marketPrefix()}resource/`
  if (p.startsWith(resourcePrefix)) {
    const resourceType = decodeURIComponent(p.slice(resourcePrefix.length))
    if (resourceType) return { view: 'resource', resourceType }
  }
  return { view: 'all-orders', resourceType: null }
}

// Shard the market views operate on; carried in the URL query so resource links
// (e.g. from My Orders) stay shard-correct. Null means "use the default shard".
function parseMarketShard(): string | null {
  return new URLSearchParams(window.location.search).get('shard')
}

// Origin room the market was opened from, carried in the URL query so the
// "target room" distance control can be pre-filled. Null means "no origin room".
function parseMarketRoom(): string | null {
  return new URLSearchParams(window.location.search).get('room')
}

function parsePower(): { view: PowerView; id: string | null } {
  const p = window.location.pathname
  if (p === `${userPowerPath()}/new`) return { view: 'new', id: null }
  if (p.startsWith(userPowerPrefix())) {
    const id = decodeURIComponent(p.slice(userPowerPrefix().length))
    if (id) return { view: 'detail', id }
  }
  return { view: 'list', id: null }
}

const [route, setRoute] = createSignal<Route>(parseRoute())
const [userView, setUserView] = createSignal<UserView>(parseUserView())
const [profileUsername, setProfileUsername] = createSignal<string | null>(parseProfileUsername())
const [messagesUsername, setMessagesUsername] = createSignal<string | null>(parseMessagesUsername())
const [marketView, setMarketView] = createSignal<MarketView>(parseMarket().view)
const [marketResourceType, setMarketResourceType] = createSignal<string | null>(parseMarket().resourceType)
const [marketShard, setMarketShard] = createSignal<string | null>(parseMarketShard())
const [marketRoom, setMarketRoom] = createSignal<string | null>(parseMarketRoom())
const [powerView, setPowerView] = createSignal<PowerView>(parsePower().view)
const [powerCreepId, setPowerCreepId] = createSignal<string | null>(parsePower().id)
const [roomOverviewTarget, setRoomOverviewTarget] = createSignal<RoomOverviewTarget | null>(parseRoomOverview())
const [leaderboardTarget, setLeaderboardTarget] = createSignal<LeaderboardTarget>(parseLeaderboard())
const [inventoryItemId, setInventoryItemId] = createSignal<string | null>(parseInventoryItem())
export { route, userView, profileUsername, messagesUsername, marketView, marketResourceType, marketShard, marketRoom, powerView, powerCreepId, roomOverviewTarget, leaderboardTarget, inventoryItemId }

// Remembered so returning to the world restores the exact game view (room +
// shard + history tick) rather than dropping back to the default map.
let lastGamePath = parseRoute() === 'game' ? currentPath() : `${basePath()}/map`

function rememberGamePath(): void {
  if (parseRoute() === 'game') lastGamePath = currentPath()
}

// The inventory lists every decoration the account owns. Filters live in component
// state rather than the URL — unlike the leaderboard, there is nothing here worth
// linking to or paging through.
export function goToInventory(itemId?: string): void {
  rememberGamePath()
  const path = itemId ? `${inventoryPrefix()}${encodeURIComponent(itemId)}` : inventoryPath()
  history.pushState(null, '', path)
  setInventoryItemId(itemId ?? null)
  setRoute('inventory')
}

export function goToUser(): void {
  rememberGamePath()
  history.pushState(null, '', userPath())
  setUserView('overview')
  setPowerView('list')
  setPowerCreepId(null)
  setRoute('user')
}

// The messages inbox (/messages), a top-level route of its own.
export function goToMessages(): void {
  rememberGamePath()
  history.pushState(null, '', messagesPath())
  setMessagesUsername(null)
  setRoute('messages')
}

// A specific conversation (/messages/<username>). Messages resolves the username
// to a user id for the list/send endpoints.
export function goToMessagesUser(username: string): void {
  rememberGamePath()
  history.pushState(null, '', `${messagesPrefix()}${encodeURIComponent(username)}`)
  setMessagesUsername(username)
  setRoute('messages')
}

export function goToUserPower(): void {
  rememberGamePath()
  history.pushState(null, '', userPowerPath())
  setUserView('power')
  setPowerCreepId(null)
  setPowerView('list')
  setRoute('user')
}

export function goToUserPowerNew(): void {
  rememberGamePath()
  history.pushState(null, '', `${userPowerPath()}/new`)
  setUserView('power')
  setPowerCreepId(null)
  setPowerView('new')
  setRoute('user')
}

export function goToUserPowerCreep(id: string): void {
  rememberGamePath()
  history.pushState(null, '', `${userPowerPrefix()}${encodeURIComponent(id)}`)
  setUserView('power')
  setPowerCreepId(id)
  setPowerView('detail')
  setRoute('user')
}

export function goToProfile(username: string): void {
  rememberGamePath()
  history.pushState(null, '', `${profilePrefix()}${encodeURIComponent(username)}`)
  setProfileUsername(username)
  setRoute('profile')
}

function leaderboardUrl(t: LeaderboardTarget): string {
  const params = new URLSearchParams()
  if (t.season) params.set('season', t.season)
  // Written even for page 1: an absent page means "resolve one for me" (jump to
  // the highlighted player's row), which is only the intent on first entry.
  if (t.page) params.set('page', String(t.page))
  if (t.highlight) params.set('highlight', t.highlight)
  const q = params.toString()
  return `${leaderboardPrefix()}${t.mode}${q ? `?${q}` : ''}`
}

// Navigate the Leaderboard. Fields left out of `patch` are carried over from the
// current target while already on the page (so paging keeps the season and the
// highlighted player) and reset to defaults when entering from elsewhere.
// `replace` swaps the history entry instead of pushing — used for the automatic
// jump to your own rank, which shouldn't cost a back press.
export function goToLeaderboard(patch: Partial<LeaderboardTarget> = {}, replace = false): void {
  const base: LeaderboardTarget = route() === 'leaderboard'
    ? leaderboardTarget()
    : { mode: 'world', season: null, page: null, highlight: null }
  const next: LeaderboardTarget = { ...base, ...patch }
  rememberGamePath()
  const url = leaderboardUrl(next)
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  setLeaderboardTarget(next)
  setRoute('leaderboard')
}

function marketQuery(shard: string | null, room: string | null): string {
  const params = new URLSearchParams()
  if (shard) params.set('shard', shard)
  if (room) params.set('room', room)
  const s = params.toString()
  return s ? `?${s}` : ''
}

// The `room` param, when omitted, preserves the current origin room so market
// sub-navigation (shard switch, resource drill-in, back to index) keeps it. Pass
// an explicit value (including null) only when entering the market afresh.
export function goToMarket(shard?: string | null, room?: string | null): void {
  const r = room === undefined ? marketRoom() : room
  rememberGamePath()
  history.pushState(null, '', `${marketPath()}${marketQuery(shard ?? null, r)}`)
  setMarketResourceType(null)
  setMarketShard(shard ?? null)
  setMarketRoom(r)
  setMarketView('all-orders')
  setRoute('market')
}

export function goToMarketResource(resourceType: string, shard?: string | null, room?: string | null): void {
  const r = room === undefined ? marketRoom() : room
  rememberGamePath()
  history.pushState(null, '', `${marketPrefix()}resource/${encodeURIComponent(resourceType)}${marketQuery(shard ?? null, r)}`)
  setMarketResourceType(resourceType)
  setMarketShard(shard ?? null)
  setMarketRoom(r)
  setMarketView('resource')
  setRoute('market')
}

export function goToMarketMyOrders(): void {
  rememberGamePath()
  history.pushState(null, '', `${marketPath()}/my`)
  setMarketResourceType(null)
  setMarketView('my-orders')
  setRoute('market')
}

export function goToMarketHistory(): void {
  rememberGamePath()
  history.pushState(null, '', `${marketPath()}/history`)
  setMarketResourceType(null)
  setMarketView('history')
  setRoute('market')
}

// The read-only per-room stats page. Distinct from goToRoom, which enters the
// live game view; this stays in the overlay layer.
export function goToRoomOverview(room: string, shard: string | null): void {
  rememberGamePath()
  history.pushState(null, '', buildRoomOverviewUrl(room, shard))
  setRoomOverviewTarget({ room, shard })
  setRoute('room-overview')
}

export function goToGame(): void {
  history.pushState(null, '', lastGamePath)
  setRoute('game')
}

// Jump straight to a specific room view (the Dashboard mounts on route→'game'
// and reads room + shard from the URL). The shard is carried as a path segment
// (/room/<shard>/<room>); see buildRoomUrl.
export function goToRoom(room: string, shard: string | null): void {
  const path = buildRoomUrl(room, shard)
  lastGamePath = path
  history.pushState(null, '', path)
  setRoute('game')
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    setRoute(parseRoute())
    setUserView(parseUserView())
    setProfileUsername(parseProfileUsername())
    setMessagesUsername(parseMessagesUsername())
    const market = parseMarket()
    setMarketView(market.view)
    setMarketResourceType(market.resourceType)
    setMarketShard(parseMarketShard())
    setMarketRoom(parseMarketRoom())
    const power = parsePower()
    setPowerView(power.view)
    setPowerCreepId(power.id)
    setRoomOverviewTarget(parseRoomOverview())
    setLeaderboardTarget(parseLeaderboard())
    setInventoryItemId(parseInventoryItem())
  })
}
