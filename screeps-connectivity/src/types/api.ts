export interface ApiOkResponse {
  ok: number
}

export interface RoomHistoryChunk {
  timestamp: number
  room: string
  base: number
  ticks: Record<string, import('./game.js').RoomObjectDiff>
}

export interface ApiAuthSigninResponse {
  ok: number
  token: string
}

export interface ApiAuthMeResponse {
  ok: number
  _id: string
  email: string
  username: string
  cpu: number
  gcl: number
  /** Raw accumulated power points; Global Power Level derives from this. Absent on servers without the power system. */
  power?: number
  credits: number
  badge: import('./game.js').Badge
  password: boolean
}

/** Per-stat lifetime totals over the requested interval — the values behind the Overview stat tiles. Individual fields may be absent on servers that don't track that stat. */
export interface ApiUserOverviewTotals {
  energyControl?: number
  energyHarvested?: number
  energyConstruction?: number
  energyCreeps?: number
  creepsProduced?: number
  creepsLost?: number
  powerProcessed?: number
}

/** Response of GET /api/user/overview. Only `totals` is consumed by the Overview tiles; per-room time series (shards/stats) are omitted until the room band is built. */
export interface ApiUserOverviewResponse {
  ok: number
  totals?: ApiUserOverviewTotals
  statsMax?: number
}

/** Response of GET /api/user/rooms?id=<userId> — the rooms a user owns. Multishard servers key by shard; single-shard servers may return a flat list. */
export interface ApiUserRoomsResponse {
  ok: number
  shards?: Record<string, string[]>
  rooms?: string[]
}

export interface ApiAuthQueryTokenResponse {
  ok: number
  token: { full: boolean }
}

export interface ApiAuthSteamTicketResponse {
  ok: number
  token: string
  steamid: string
}

export interface ApiAuthModInfoResponse {
  ok: number
  name: string
  version: string
  allowRegistration: boolean
  steam: boolean
  github: boolean
  gitlab: boolean
}

export interface ApiRegisterCheckResponse {
  ok: number
  error?: string
}

export interface ApiRoomTerrainResponse {
  ok: number
  terrain: Array<{
    _id: string
    room: string
    terrain: string
    type: string
  }>
}

export interface ApiRoomObjectsResponse {
  ok: number
  objects: unknown[]
  users: Record<string, unknown>
}

export interface ApiVersionResponse {
  ok: number
  package: number
  protocol: number
  users: number
  serverData: {
    historyChunkSize: number
    features: Array<{ name: string }>
    shards: string[]
    customObjectTypes?: unknown
  }
}

export interface ApiShardsInfoResponse {
  ok: number
  shards: Array<{
    name: string
    lastTicks: number[]
    cpuLimit: number
    rooms: number
    users: number
    tick: number
  }>
}

export interface ApiUserBranchesResponse {
  ok: number
  list: Array<{
    _id: string
    branch: string
    activeWorld: boolean
    activeSim: boolean
  }>
}

export interface ApiLeaderboardListResponse {
  ok: number
  list: Array<{ _id: string; season: string; user: string; score: number; rank: number }>
  count: number
  users: Record<string, { _id: string; username: string; badge: import('./game.js').Badge; gcl: number }>
}

export interface ApiLeaderboardSeasonsResponse {
  ok: number
  seasons: Array<{ _id: string; name: string; date: string }>
}

export interface ApiMapStatsRoomStat {
  status: string
  novice: number | null
  respawnArea: number | null
  openTime: number | null
  own?: { user: string; level: number }
  sign?: { user: string; text: string; time: number; datetime: number }
  safeMode?: boolean
  [mineral: `minerals${number}`]: { type: string; density: number } | undefined
}

export interface ApiMapStatsBadge {
  type: number | { path1: string; path2: string }
  color1: string
  color2: string
  color3: string
  param?: number
  flip: boolean
}

export interface ApiGameRoomsResponse {
  ok: number
  rooms: Array<{
    _id: string
    room: string
    terrain: string
  }>
}

export interface ApiMapStatsResponse {
  ok: number
  gameTime: number
  stats: Record<string, ApiMapStatsRoomStat>
  statsMax: Record<string, unknown>
  users: Record<string, { _id: string; username: string; badge: ApiMapStatsBadge }>
}

export interface ApiCreateFlagResponse {
  ok: number
  name?: string
  error?: string
}

export interface ApiGenUniqueFlagNameResponse {
  ok: number
  name: string
}

export interface ApiCheckUniqueFlagNameResponse {
  ok: number
  error?: string
}

export interface ApiChangeFlagColorResponse {
  ok: number
}

export interface ApiRemoveFlagResponse {
  ok: number
}

export interface ApiGenUniqueObjectNameResponse {
  ok: number
  name: string
}

export interface ApiCheckUniqueObjectNameResponse {
  ok: number
  error?: string
}

export interface ApiGameTickResponse {
  ok: number
  tick: number
}

export interface ApiPowerCreep {
  _id: string
  name: string
  className: string
  level: number
  powers: Record<string, { level: number; cooldownTime?: number }>
  deleteTime?: number
}

export interface ApiPowerCreepsListResponse {
  ok: number
  list: ApiPowerCreep[]
}

export interface ApiUserFindResponse {
  ok: number
  user: {
    _id: string
    username: string
    badge: import('./game.js').Badge
    gcl: number
    // Lifetime power (GPL) — present in the public lookup alongside gcl.
    power?: number
  }
}

/** Response of GET /api/user/stats?id=&interval=. `stats` maps a metric to per-tick buckets; consumers sum the bucket values over the interval. */
export interface ApiUserStatsResponse {
  ok: number
  stats?: Record<string, Array<{ value: number; endTime?: number }>>
  statsMax?: Record<string, number>
}

/** Response of GET /api/leaderboard/find?username=&mode=&season=. Servers return either a flat list of per-season records or a single season-scoped record at the top level. */
export interface ApiLeaderboardFindResponse {
  ok: number
  list?: Array<{ season: string; rank: number; score: number; user: string }>
  rank?: number
  score?: number
  season?: string
  user?: string
}

export interface ApiUserMoneyHistoryResponse {
  ok: number
  page: number
  // True when an older page exists; drives the History "Older" pager.
  hasMore?: boolean
  list: Array<{
    _id: string
    date: string
    tick: number
    type: string
    balance: number
    change: number
    // Shard the transaction occurred on (official multi-shard servers only).
    shard?: string
    market?: unknown
  }>
}

// Market — a single order from game/market/orders (public) or my-orders (own).
// `active`/`totalAmount` are returned only for your own orders. `range` is not
// part of the API response — the client computes it as the room distance to a
// chosen target room.
export interface ApiMarketOrder {
  _id: string
  type: 'sell' | 'buy'
  resourceType: string
  price: number
  amount: number
  remainingAmount: number
  /** Original order size — own orders only. */
  totalAmount?: number
  /** Whether the order is currently funded/stocked — own orders only. */
  active?: boolean
  /** Source/target room; absent for token and other roomless orders. */
  roomName?: string
  created?: number
}

export interface ApiMarketOrdersIndexResponse {
  ok: number
  // One entry per resource type that has open orders; `_id` is the resource type.
  list: Array<{ _id: string; count: number }>
}

export interface ApiMarketOrdersResponse {
  ok: number
  list: ApiMarketOrder[]
}

// Own orders: multi-shard servers return `shards` keyed by shard name;
// single-shard servers return a flat `list` instead.
export interface ApiMarketMyOrdersResponse {
  ok: number
  shards?: Record<string, ApiMarketOrder[]>
  list?: ApiMarketOrder[]
}

export interface ApiMarketStat {
  date: string
  transactions: number
  volume: number
  avgPrice: number
  stddevPrice: number
}

export interface ApiMarketStatsResponse {
  ok: number
  stats: ApiMarketStat[]
}

export interface ApiUserMessage {
  _id: string
  date: string
  respondent: string
  user: string
  text: string
  type?: 'in' | 'out'
  unread: boolean
}

export interface ApiUserMessagesListResponse {
  ok: number
  messages: ApiUserMessage[]
}

export interface ApiUserMessagesIndexEntry {
  _id: string
  message: ApiUserMessage
}

export interface ApiUserMessagesIndexResponse {
  ok: number
  messages: ApiUserMessagesIndexEntry[]
  users: Record<string, { _id: string; username: string; badge: import('./game.js').Badge }>
}

export interface ApiUserMessagesUnreadCountResponse {
  ok: number
  count: number
}

export interface ApiRoomDecorationGraphic {
  url: string
  color?: string
  alpha?: string
  visible?: string
}

export interface ApiRoomDecorationDef {
  _id: string
  type: 'floorLandscape' | 'wallLandscape' | 'wallGraffiti' | 'creep' | 'object' | 'metadata'
  graphics?: ApiRoomDecorationGraphic[]
  foregroundUrl?: string
  floorForegroundUrl?: string
  tileScale?: number | string
  [key: string]: unknown
}

/** User-configured properties for an activated decoration. Number fields may arrive as strings from the API. */
export interface ApiRoomDecorationActive {
  // floorLandscape
  floorBackgroundColor?: string
  floorBackgroundBrightness?: number | string
  floorForegroundColor?: string
  floorForegroundBrightness?: number | string
  floorForegroundAlpha?: number | string
  swampColor?: string
  swampStrokeColor?: string
  swampStrokeWidth?: number | string
  roadsColor?: string
  roadsBrightness?: number | string
  // wallLandscape
  backgroundColor?: string
  backgroundBrightness?: number | string
  strokeColor?: string
  strokeBrightness?: number | string
  strokeWidth?: number | string
  strokeLighting?: number | string
  foregroundColor?: string
  foregroundAlpha?: number | string
  foregroundBrightness?: number | string
  // creep / object
  user?: string
  nameFilter?: string
  exclude?: boolean
  width?: number | string
  height?: number | string
  brightness?: number | string
  lighting?: boolean
  animation?: string
  position?: string
  syncRotate?: boolean
  flip?: boolean
  [key: string]: unknown
}

/** Raw decoration item as returned by /api/game/room-decorations. */
export interface ApiRoomDecorationItem {
  _id: string
  user: string
  active: ApiRoomDecorationActive
  decoration: ApiRoomDecorationDef
}

export interface ApiRoomDecorationsResponse {
  ok: number
  decorations: ApiRoomDecorationItem[]
}
