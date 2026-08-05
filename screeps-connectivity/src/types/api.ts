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

/** Response of GET /api/game/room-overview?room=&interval=&shard=. `stats` holds per-stat time-series buckets over the requested interval (same metric keys as the account overview tiles); `owner` is absent for unowned rooms. */
export interface ApiRoomOverviewResponse {
  ok: number
  owner?: { username: string; badge: import('./game.js').Badge } | null
  stats?: Record<string, Array<{ value: number; endTime: number }>>
  statsMax?: Record<string, number>
  totals?: ApiUserOverviewTotals
}

/** Response of GET /api/user/rooms?id=<userId> — the rooms a user owns. Multishard servers key by shard; single-shard servers may return a flat list. */
export interface ApiUserRoomsResponse {
  ok: number
  shards?: Record<string, string[]>
  rooms?: string[]
  /** Only present when asking with `reservation` — rooms reserved rather than owned. */
  reservations?: Record<string, string[]>
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
    /**
     * Retention window for room history, in ticks. Non-official field added by the
     * xxscreeps history mod. When present, the earliest replayable tick is roughly
     * `currentTick - historyKeepTicks`; a value of `0` means history is kept forever
     * (unbounded). Absent on servers without the mod.
     */
    historyKeepTicks?: number
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

/** One entry in a branch's module map: JS source text, or a binary
 *  (WebAssembly) module carried as base64. */
export type ApiCodeModule = string | { binary: string }

export interface ApiUserCodeResponse {
  ok: number
  branch: string
  modules: Record<string, ApiCodeModule>
}

/** The two ranking tables the world game keeps: `world` scores control points
 *  earned upgrading controllers, `power` scores power processed. (The official
 *  server also ranks the retired arena/survival modes; they have no client here.) */
export type LeaderboardMode = 'world' | 'power'

/** One row of the ranking table. `rank` is 0-based — render it as `rank + 1`. */
export interface ApiLeaderboardEntry {
  _id: string
  season: string
  user: string
  score: number
  rank: number
}

/** The player records the ranking rows point at, keyed by user id. Private
 *  servers may omit badge/gcl, so both are optional. */
export interface ApiLeaderboardUser {
  _id: string
  username: string
  badge?: import('./game.js').Badge
  gcl?: number
}

export interface ApiLeaderboardListResponse {
  ok: number
  list: ApiLeaderboardEntry[]
  /** Total ranked players in the season — the pager's row count, not the page length. */
  count: number
  users: Record<string, ApiLeaderboardUser>
}

export interface ApiLeaderboardSeasonsResponse {
  ok: number
  seasons: Array<{ _id: string; name: string; date: string }>
}

export interface ApiDecorationActive {
  /** Set when the decoration is meant to show on the world map. */
  world?: boolean
  tileScale?: number | string
  // floor landscape
  floorBackgroundColor?: string
  floorBackgroundBrightness?: number | string
  floorForegroundColor?: string
  floorForegroundBrightness?: number | string
  floorForegroundAlpha?: string | number
  swampColor?: string
  swampStrokeColor?: string
  roadsColor?: string
  roadsBrightness?: number | string
  // wall landscape
  foregroundColor?: string
  foregroundBrightness?: number | string
  foregroundAlpha?: number | string
  backgroundColor?: string
  backgroundBrightness?: number | string
  strokeColor?: string
  // graffiti geometry, in room cells
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  alpha?: number | string
  brightness?: number | string
  lighting?: boolean | string
  [key: string]: unknown
}

export interface ApiMapStatsRoomStat {
  status: string
  novice: number | null
  respawnArea: number | null
  openTime: number | null
  own?: { user: string; level: number }
  sign?: { user: string; text: string; time: number; datetime: number }
  safeMode?: boolean
  minerals0?: { type: string; density: number }
  decorations?: Array<{ _id: string; user: string; decoration: string; active: ApiDecorationActive }>
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

/**
 * Reduced decoration definition, as delivered by the `decorations` dictionary of
 * `map-stats`. Deliberately smaller than the room-view definition — the world map only
 * needs the type, the graphics and the two landscape overlay textures.
 */
export interface ApiMapStatsDecorationDef {
  type?: string
  graphics?: ApiRoomDecorationGraphic[]
  tiling?: boolean
  foregroundUrl?: string
  floorForegroundUrl?: string
  [key: string]: unknown
}

export interface ApiMapStatsResponse {
  ok: number
  gameTime: number
  stats: Record<string, ApiMapStatsRoomStat>
  statsMax: Record<string, unknown>
  users: Record<string, { _id: string; username: string; badge: ApiMapStatsBadge }>
  /** Definitions referenced by the `decoration` id on each `stat.decorations[]` entry. */
  decorations?: Record<string, ApiMapStatsDecorationDef>
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

/**
 * Response of GET /api/user/stats?id=&interval=. `stats` maps a metric to
 * either per-tick buckets (consumers sum the bucket values over the interval)
 * or a single pre-summed total for the interval — servers differ on which.
 */
export interface ApiUserStatsResponse {
  ok: number
  stats?: Record<string, number | Array<{ value: number; endTime?: number }>>
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

/**
 * Schema of one editable property of a decoration.
 *
 * `default` seeds the value when the decoration is first activated. `readonly` props are
 * still part of the active state — they just aren't offered in the editor.
 */
export interface ApiDecorationProp {
  type?: 'color' | 'range' | 'boolean' | 'display' | 'string'
  label?: string
  readonly?: boolean
  default?: unknown
  /** `range` only. */
  min?: number
  max?: number
  step?: number
}

/**
 * `decoration.props` mixes two things: a descriptor per editable property, and a handful
 * of scalar layout constraints read straight off the object (`proportional`, the
 * width/height bounds). Index into it by prop name for the former.
 */
export interface ApiDecorationProps {
  /** Force the original aspect ratio while resizing. */
  proportional?: boolean
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  [name: string]: ApiDecorationProp | boolean | number | undefined
}

export interface ApiRoomDecorationGraphic {
  url: string
  color?: string
  alpha?: string
  visible?: string
}

export interface ApiRoomDecorationDef {
  _id: string
  /** `landscape` is the combined type — it acts as both a floor and a wall landscape. */
  type: 'floorLandscape' | 'wallLandscape' | 'landscape' | 'wallGraffiti' | 'creep' | 'object' | 'metadata' | 'badge'
  name?: string
  /** 1–5. Drives the colour and glow of the rarity indicator. */
  rarity?: number
  /** Id of the theme this decoration belongs to. */
  theme?: string
  /** Cannot be converted to pixels or transferred to Steam. */
  restricted?: boolean
  groupDescription?: string
  preview?: { original?: string; '128x128'?: string; '256x256'?: string }
  /** Schema of the editable properties, plus the layout constraints. */
  props?: ApiDecorationProps
  graphics?: ApiRoomDecorationGraphic[]
  foregroundUrl?: string
  floorForegroundUrl?: string
  /** Render the graphics as a repeating tile instead of a single stretched sprite. */
  tiling?: boolean
  tileScale?: number | string
  /** Target object type, `type === 'object'` only. */
  objectType?: string
  /** The badge symbol this decoration grants while worn, `type === 'badge'` only. */
  badge?: import('./game.js').BadgeSymbol
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
  // geometry — cells for wallGraffiti, pixels for creep/object
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  /** Radians. The official UI edits this in degrees. */
  rotation?: number | string
  flip?: boolean | string
  alpha?: number | string
  brightness?: number | string
  tileScale?: number | string
  lighting?: boolean | string
  animation?: string
  // target
  shard?: string
  room?: string
  // creep / object
  user?: string
  /** `!SEP!`-separated list, not an array. */
  nameFilter?: string
  exclude?: boolean | string
  position?: string
  syncRotate?: boolean | string
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

/**
 * One decoration owned by the logged-in user, as returned by the inventory.
 *
 * `active` is `null` while the decoration is not placed; once activated it carries the
 * chosen prop values plus the target `shard`/`room` (absent for the globally-active
 * `creep` and `badge` types).
 */
export interface ApiUserDecorationItem {
  _id: string
  /** Sort key for "new to old". */
  createdAt: string
  activatedAt?: string
  active: ApiRoomDecorationActive | null
  decoration: ApiRoomDecorationDef
}

export interface ApiUserDecorationsInventoryResponse {
  ok: number
  list: ApiUserDecorationItem[]
}

export interface ApiDecorationTheme {
  _id: string
  name: string
  color?: string
  /** Not offered in the inventory's theme filter. */
  hidden?: boolean
  /** Not selectable as a pixelization target. */
  restricted?: boolean
}

export interface ApiDecorationThemesResponse {
  ok: number
  list: ApiDecorationTheme[]
}
