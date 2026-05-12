import type { HttpClient } from '../HttpClient.js'
import type { ApiUserBranchesResponse } from '../../types/api.js'

const DEFAULT_SHARD = 'shard0'

export interface UserEndpoints {
  branches(): Promise<ApiUserBranchesResponse>
  code: {
    get(branch: string): Promise<unknown>
    set(branch: string, modules: Record<string, string>): Promise<unknown>
  }
  memory: {
    get(path: string, shard?: string): Promise<{ ok: number; data: unknown }>
    set(path: string, value: unknown, shard?: string): Promise<unknown>
    segment: {
      get(segment: number, shard?: string): Promise<{ ok: number; data: string }>
      set(segment: number, data: string, shard?: string): Promise<unknown>
    }
  }
  console(expression: string, shard?: string): Promise<unknown>
  stats(interval: number): Promise<unknown>
  rooms(id: string): Promise<unknown>
  overview(interval: number, statName: string): Promise<unknown>
  worldStatus(): Promise<{ ok: number; status: 'normal' | 'lost' | 'empty' }>
  worldStartRoom(shard?: string): Promise<unknown>
}

export function createUserEndpoints(http: HttpClient): UserEndpoints {
  return {
    branches: () => http.request('GET', '/api/user/branches'),
    code: {
      get: (branch) => http.request('GET', '/api/user/code', { branch }),
      set: (branch, modules) => http.request('POST', '/api/user/code', { branch, modules, _hash: Date.now() }),
    },
    memory: {
      get: (path, shard = DEFAULT_SHARD) => http.request('GET', '/api/user/memory', { path, shard }),
      set: (path, value, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/memory', { path, value, shard }),
      segment: {
        get: (segment, shard = DEFAULT_SHARD) => http.request('GET', '/api/user/memory-segment', { segment, shard }),
        set: (segment, data, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/memory-segment', { segment, data, shard }),
      },
    },
    console: (expression, shard = DEFAULT_SHARD) => http.request('POST', '/api/user/console', { expression, shard }),
    stats: (interval) => http.request('GET', '/api/user/stats', { interval }),
    rooms: (id) => http.request('GET', '/api/user/rooms', { id }),
    overview: (interval, statName) => http.request('GET', '/api/user/overview', { interval, statName }),
    worldStatus: () => http.request('GET', '/api/user/world-status'),
    worldStartRoom: (shard = DEFAULT_SHARD) => http.request('GET', '/api/user/world-start-room', { shard }),
  }
}
