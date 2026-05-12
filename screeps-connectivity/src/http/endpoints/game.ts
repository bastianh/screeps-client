import type { HttpClient } from '../HttpClient.js'
import type { ApiRoomTerrainResponse, ApiRoomObjectsResponse, ApiShardsInfoResponse } from '../../types/api.js'

const DEFAULT_SHARD = 'shard0'

export interface GameEndpoints {
  roomTerrain(room: string, shard?: string): Promise<ApiRoomTerrainResponse>
  roomObjects(room: string, shard?: string): Promise<ApiRoomObjectsResponse>
  roomStatus(room: string, shard?: string): Promise<{ ok: number; status: string; novice?: string }>
  roomOverview(room: string, interval?: number, shard?: string): Promise<unknown>
  time(shard?: string): Promise<{ ok: number; time: number }>
  worldSize(shard?: string): Promise<unknown>
  mapStats(rooms: string[], statName: string, shard?: string): Promise<unknown>
  market: {
    ordersIndex(shard?: string): Promise<unknown>
    myOrders(): Promise<unknown>
    orders(resourceType: string, shard?: string): Promise<unknown>
    stats(resourceType: string, shard?: string): Promise<unknown>
  }
  shards: {
    info(): Promise<ApiShardsInfoResponse>
  }
}

export function createGameEndpoints(http: HttpClient): GameEndpoints {
  return {
    roomTerrain: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-terrain', { room, encoded: 1, shard }),
    roomObjects: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-objects', { room, shard }),
    roomStatus: (room, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-status', { room, shard }),
    roomOverview: (room, interval = 8, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/room-overview', { room, interval, shard }),
    time: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/time', { shard }),
    worldSize: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/world-size', { shard }),
    mapStats: (rooms, statName, shard = DEFAULT_SHARD) => http.request('POST', '/api/game/map-stats', { rooms, statName, shard }),
    market: {
      ordersIndex: (shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/orders-index', { shard }),
      myOrders: () => http.request('GET', '/api/game/market/my-orders'),
      orders: (resourceType, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/orders', { resourceType, shard }),
      stats: (resourceType, shard = DEFAULT_SHARD) => http.request('GET', '/api/game/market/stats', { resourceType, shard }),
    },
    shards: {
      info: () => http.request('GET', '/api/game/shards/info'),
    },
  }
}
