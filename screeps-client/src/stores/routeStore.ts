import { createSignal } from 'solid-js'
import { basePath } from '~/utils/embedded.js'

// Top-level screen the connected app shows. The in-game Dashboard owns its own
// /room and /map sub-routing; this store decides Overview (self) vs. Profile
// (public, any user) vs. Market vs. Power Creeps vs. the game view.
export type Route = 'overview' | 'profile' | 'game' | 'market' | 'power'

// Sub-view within the Market section: the resource index (all-orders), a single
// resource's order book (resource), your own orders, or the credit history.
export type MarketView = 'all-orders' | 'resource' | 'my-orders' | 'history'

// Sub-view within the Power Creeps section (list / create / per-creep detail).
export type PowerView = 'list' | 'new' | 'detail'

function overviewPath(): string {
  return `${basePath()}/overview`
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

function powerPath(): string {
  return `${basePath()}/power`
}

function powerPrefix(): string {
  return `${basePath()}/power/`
}

function currentPath(): string {
  return window.location.pathname + window.location.search + window.location.hash
}

function parseRoute(): Route {
  const p = window.location.pathname
  if (p === overviewPath()) return 'overview'
  if (p.startsWith(profilePrefix())) return 'profile'
  if (p === marketPath() || p.startsWith(marketPrefix())) return 'market'
  if (p === powerPath() || p.startsWith(powerPrefix())) return 'power'
  return 'game'
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
  if (p === `${powerPath()}/new`) return { view: 'new', id: null }
  if (p.startsWith(powerPrefix())) {
    const id = decodeURIComponent(p.slice(powerPrefix().length))
    if (id) return { view: 'detail', id }
  }
  return { view: 'list', id: null }
}

const [route, setRoute] = createSignal<Route>(parseRoute())
const [profileUsername, setProfileUsername] = createSignal<string | null>(parseProfileUsername())
const [marketView, setMarketView] = createSignal<MarketView>(parseMarket().view)
const [marketResourceType, setMarketResourceType] = createSignal<string | null>(parseMarket().resourceType)
const [marketShard, setMarketShard] = createSignal<string | null>(parseMarketShard())
const [powerView, setPowerView] = createSignal<PowerView>(parsePower().view)
const [powerCreepId, setPowerCreepId] = createSignal<string | null>(parsePower().id)
export { route, profileUsername, marketView, marketResourceType, marketShard, powerView, powerCreepId }

// Remembered so returning to the world restores the exact game view (room +
// shard + history tick) rather than dropping back to the default map.
let lastGamePath = parseRoute() === 'game' ? currentPath() : `${basePath()}/map`

function rememberGamePath(): void {
  if (parseRoute() === 'game') lastGamePath = currentPath()
}

export function goToOverview(): void {
  rememberGamePath()
  history.pushState(null, '', overviewPath())
  setRoute('overview')
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

export function goToPower(): void {
  rememberGamePath()
  history.pushState(null, '', powerPath())
  setPowerCreepId(null)
  setPowerView('list')
  setRoute('power')
}

export function goToPowerNew(): void {
  rememberGamePath()
  history.pushState(null, '', `${powerPath()}/new`)
  setPowerCreepId(null)
  setPowerView('new')
  setRoute('power')
}

export function goToPowerCreep(id: string): void {
  rememberGamePath()
  history.pushState(null, '', `${powerPrefix()}${encodeURIComponent(id)}`)
  setPowerCreepId(id)
  setPowerView('detail')
  setRoute('power')
}

export function goToGame(): void {
  history.pushState(null, '', lastGamePath)
  setRoute('game')
}

// Jump straight to a specific room view (the Dashboard mounts on route→'game'
// and reads room + shard from the URL).
export function goToRoom(room: string, shard: string | null): void {
  const path = `${basePath()}/room/${room}${shard ? `?shard=${encodeURIComponent(shard)}` : ''}`
  lastGamePath = path
  history.pushState(null, '', path)
  setRoute('game')
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    setRoute(parseRoute())
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
