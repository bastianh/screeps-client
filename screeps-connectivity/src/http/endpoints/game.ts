import type { HttpClient } from '../HttpClient.js'
import type {
  ApiRoomTerrainResponse,
  ApiRoomObjectsResponse,
  ApiShardsInfoResponse,
  ApiMapStatsResponse,
  ApiGameRoomsResponse,
  ApiCreateFlagResponse,
  ApiGenUniqueFlagNameResponse,
  ApiCheckUniqueFlagNameResponse,
  ApiChangeFlagColorResponse,
  ApiRemoveFlagResponse,
  ApiGenUniqueObjectNameResponse,
  ApiCheckUniqueObjectNameResponse,
  ApiGameTickResponse,
} from '../../types/api.js'
import { createPowerCreepsEndpoints, type PowerCreepsEndpoints } from './power-creeps.js'

export interface GameEndpoints {
  roomTerrain(room: string, shard?: string | null): Promise<ApiRoomTerrainResponse>
  /** @deprecated Not available on private servers (backend-local). Room objects are delivered via the `room:<name>` WebSocket channel. */
  roomObjects(room: string, shard?: string | null): Promise<ApiRoomObjectsResponse>
  roomStatus(room: string, shard?: string | null): Promise<{ ok: number; status: string; novice?: string }>
  roomOverview(room: string, interval?: number, shard?: string | null): Promise<unknown>
  time(shard?: string | null): Promise<{ ok: number; time: number }>
  tick(): Promise<ApiGameTickResponse>
  worldSize(shard?: string | null): Promise<unknown>
  mapStats(rooms: string[], statName: string, shard?: string | null): Promise<ApiMapStatsResponse>
  roomsTerrain(rooms: string[], shard?: string | null): Promise<ApiGameRoomsResponse>
  createFlag(room: string, x: number, y: number, name: string, color: number, secondaryColor: number, shard?: string | null): Promise<ApiCreateFlagResponse>
  genUniqueFlagName(): Promise<ApiGenUniqueFlagNameResponse>
  checkUniqueFlagName(name: string): Promise<ApiCheckUniqueFlagNameResponse>
  changeFlagColor(room: string, name: string, color: number, secondaryColor: number): Promise<ApiChangeFlagColorResponse>
  removeFlag(room: string, name: string): Promise<ApiRemoveFlagResponse>
  genUniqueObjectName(type: string, shard?: string | null): Promise<ApiGenUniqueObjectNameResponse>
  checkUniqueObjectName(type: string, name: string, shard?: string | null): Promise<ApiCheckUniqueObjectNameResponse>
  placeSpawn(room: string, x: number, y: number, name?: string, shard?: string | null): Promise<{ ok: number }>
  createConstruction(room: string, x: number, y: number, structureType: string, name?: string, shard?: string | null): Promise<{ ok: number }>
  removeConstructionSite(room: string, ids: string[], shard?: string | null): Promise<{ ok: number }>
  addObjectIntent(id: string, room: string, name: string, intent: unknown, shard?: string | null): Promise<{ ok: number }>
  addGlobalIntent(name: string, intent: unknown): Promise<{ ok: number }>
  setNotifyWhenAttacked(id: string, enabled: boolean): Promise<{ ok: number }>
  createInvader(room: string, x: number, y: number, size: number, type: string, boosted?: boolean): Promise<{ ok: number }>
  removeInvader(id: string): Promise<{ ok: number }>
  powerCreeps: PowerCreepsEndpoints
  market: {
    ordersIndex(shard?: string | null): Promise<unknown>
    myOrders(): Promise<unknown>
    orders(resourceType: string, shard?: string | null): Promise<unknown>
    stats(resourceType: string, shard?: string | null): Promise<unknown>
  }
  shards: {
    info(): Promise<ApiShardsInfoResponse>
  }
}

function withShard(params: Record<string, unknown>, shard?: string | null): Record<string, unknown> {
  if (shard) params.shard = shard
  return params
}

export function createGameEndpoints(http: HttpClient): GameEndpoints {
  return {
    roomTerrain: (room, shard) => http.request('GET', '/api/game/room-terrain', withShard({ room, encoded: 1 }, shard)),
    roomObjects: (room, shard) => http.request('GET', '/api/game/room-objects', withShard({ room }, shard)),
    roomStatus: (room, shard) => http.request('GET', '/api/game/room-status', withShard({ room }, shard)),
    roomOverview: (room, interval = 8, shard) => http.request('GET', '/api/game/room-overview', withShard({ room, interval }, shard)),
    time: (shard) => http.request('GET', '/api/game/time', withShard({}, shard)),
    worldSize: (shard) => http.request('GET', '/api/game/world-size', withShard({}, shard)),
    mapStats: (rooms, statName, shard) => http.request('POST', '/api/game/map-stats', withShard({ rooms, statName }, shard)),
    roomsTerrain: (rooms, shard) => {
      const params = new URLSearchParams({ encoded: 'true' })
      if (shard) params.set('shard', shard)
      return http.request('POST', `/api/game/rooms?${params}`, { rooms })
    },
    createFlag: (room, x, y, name, color, secondaryColor, shard) => http.request('POST', '/api/game/create-flag', withShard({ room, x, y, name, color, secondaryColor }, shard)),
    genUniqueFlagName: () => http.request('POST', '/api/game/gen-unique-flag-name'),
    checkUniqueFlagName: (name) => http.request('POST', '/api/game/check-unique-flag-name', { name }),
    changeFlagColor: (room, name, color, secondaryColor) => http.request('POST', '/api/game/change-flag-color', { room, name, color, secondaryColor }),
    removeFlag: (room, name) => http.request('POST', '/api/game/remove-flag', { room, name }),
    genUniqueObjectName: (type, shard) => http.request('POST', '/api/game/gen-unique-object-name', withShard({ type }, shard)),
    checkUniqueObjectName: (type, name, shard) => http.request('POST', '/api/game/check-unique-object-name', withShard({ type, name }, shard)),
    placeSpawn: (room, x, y, name, shard) => http.request('POST', '/api/game/place-spawn', withShard({ room, x, y, ...(name ? { name } : {}) }, shard)),
    createConstruction: (room, x, y, structureType, name, shard) => http.request('POST', '/api/game/create-construction', withShard({ room, x, y, structureType, ...(name ? { name } : {}) }, shard)),
    removeConstructionSite: (room, ids, shard) => http.request('POST', '/api/game/add-object-intent', withShard({ _id: 'room', room, name: 'removeConstructionSite', intent: ids.map(id => ({ id, roomName: room })) }, shard)),
    addObjectIntent: (id, room, name, intent, shard) => http.request('POST', '/api/game/add-object-intent', withShard({ _id: id, room, name, intent }, shard)),
    addGlobalIntent: (name, intent) => http.request('POST', '/api/game/add-global-intent', { name, intent }),
    setNotifyWhenAttacked: (id, enabled) => http.request('POST', '/api/game/set-notify-when-attacked', { _id: id, enabled }),
    createInvader: (room, x, y, size, type, boosted) => http.request('POST', '/api/game/create-invader', { room, x, y, size, type, ...(boosted != null ? { boosted } : {}) }),
    removeInvader: (id) => http.request('POST', '/api/game/remove-invader', { _id: id }),
    tick: () => http.request('GET', '/api/game/tick'),
    powerCreeps: createPowerCreepsEndpoints(http),
    market: {
      ordersIndex: (shard) => http.request('GET', '/api/game/market/orders-index', withShard({}, shard)),
      myOrders: () => http.request('GET', '/api/game/market/my-orders'),
      orders: (resourceType, shard) => http.request('GET', '/api/game/market/orders', withShard({ resourceType }, shard)),
      stats: (resourceType, shard) => http.request('GET', '/api/game/market/stats', withShard({ resourceType }, shard)),
    },
    shards: {
      info: () => http.request('GET', '/api/game/shards/info'),
    },
  }
}
