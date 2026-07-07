import { createSignal } from 'solid-js'
import { basePath } from '~/utils/embedded.js'
import { buildRoomUrl } from '~/utils/gameRoutes.js'

// Top-level screen the connected app shows. The in-game Dashboard owns its own
// /room and /map sub-routing; this store decides the User hub (/user) vs.
// Profile (public, any user) vs. Market vs. the game view.
export type Route = 'user' | 'profile' | 'game' | 'market'

// Sub-view within the User hub: the overview stats page, the power creeps
// manager, or the messages inbox. Exactly one is active at a time.
export type UserView = 'overview' | 'power' | 'messages'

// Sub-view within the Market section: the resource index (all-orders), a single
// resource's order book (resource), your own orders, or the credit history.
export type MarketView = 'all-orders' | 'resource' | 'my-orders' | 'history'

// Sub-view within the Power Creeps section (list / create / per-creep detail).
export type PowerView = 'list' | 'new' | 'detail'

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

function userMessagesPath(): string {
  return `${basePath()}/user/messages`
}

function profilePrefix(): string {
  return `${basePath()}/profile/`
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
  if (p === marketPath() || p.startsWith(marketPrefix())) return 'market'
  return 'game'
}

function parseUserView(): UserView {
  const p = window.location.pathname
  if (p === userPowerPath() || p.startsWith(userPowerPrefix())) return 'power'
  if (p === userMessagesPath()) return 'messages'
  return 'overview'
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
const [marketView, setMarketView] = createSignal<MarketView>(parseMarket().view)
const [marketResourceType, setMarketResourceType] = createSignal<string | null>(parseMarket().resourceType)
const [marketShard, setMarketShard] = createSignal<string | null>(parseMarketShard())
const [powerView, setPowerView] = createSignal<PowerView>(parsePower().view)
const [powerCreepId, setPowerCreepId] = createSignal<string | null>(parsePower().id)
export { route, userView, profileUsername, marketView, marketResourceType, marketShard, powerView, powerCreepId }

// Remembered so returning to the world restores the exact game view (room +
// shard + history tick) rather than dropping back to the default map.
let lastGamePath = parseRoute() === 'game' ? currentPath() : `${basePath()}/map`

function rememberGamePath(): void {
  if (parseRoute() === 'game') lastGamePath = currentPath()
}

export function goToUser(): void {
  rememberGamePath()
  history.pushState(null, '', userPath())
  setUserView('overview')
  setPowerView('list')
  setPowerCreepId(null)
  setRoute('user')
}

export function goToUserMessages(): void {
  rememberGamePath()
  history.pushState(null, '', userMessagesPath())
  setUserView('messages')
  setPowerView('list')
  setPowerCreepId(null)
  setRoute('user')
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

function shardQuery(shard: string | null): string {
  return shard ? `?shard=${encodeURIComponent(shard)}` : ''
}

export function goToMarket(shard?: string | null): void {
  rememberGamePath()
  history.pushState(null, '', `${marketPath()}${shardQuery(shard ?? null)}`)
  setMarketResourceType(null)
  setMarketShard(shard ?? null)
  setMarketView('all-orders')
  setRoute('market')
}

export function goToMarketResource(resourceType: string, shard?: string | null): void {
  rememberGamePath()
  history.pushState(null, '', `${marketPrefix()}resource/${encodeURIComponent(resourceType)}${shardQuery(shard ?? null)}`)
  setMarketResourceType(resourceType)
  setMarketShard(shard ?? null)
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
    const market = parseMarket()
    setMarketView(market.view)
    setMarketResourceType(market.resourceType)
    setMarketShard(parseMarketShard())
    const power = parsePower()
    setPowerView(power.view)
    setPowerCreepId(power.id)
  })
}
