export interface ApiOkResponse {
  ok: number
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
  badge: unknown
  password: boolean
}

export interface ApiAuthQueryTokenResponse {
  ok: number
  token: { full: boolean }
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
  users: Record<string, { _id: string; username: string; badge: unknown; gcl: number }>
}

export interface ApiLeaderboardSeasonsResponse {
  ok: number
  seasons: Array<{ _id: string; name: string; date: string }>
}
