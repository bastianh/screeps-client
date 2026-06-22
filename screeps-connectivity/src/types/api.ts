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
  credits: number
  badge: import('./game.js').Badge
  password: boolean
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
  }
}

export interface ApiUserMoneyHistoryResponse {
  ok: number
  page: number
  list: Array<{
    _id: string
    date: string
    tick: number
    type: string
    balance: number
    change: number
    market?: unknown
  }>
}

export interface ApiUserMessage {
  _id: string
  date: string
  respondent: string
  user: string
  text: string
  unread: boolean
}

export interface ApiUserMessagesListResponse {
  ok: number
  messages: ApiUserMessage[]
}

export interface ApiUserMessagesIndexEntry {
  _id: string
  message: ApiUserMessage
  user: { _id: string; username: string; badge: import('./game.js').Badge }
}

export interface ApiUserMessagesIndexResponse {
  ok: number
  list: ApiUserMessagesIndexEntry[]
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
