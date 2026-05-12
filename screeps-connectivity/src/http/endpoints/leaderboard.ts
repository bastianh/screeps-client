import type { HttpClient } from '../HttpClient.js'
import type { ApiLeaderboardListResponse, ApiLeaderboardSeasonsResponse } from '../../types/api.js'

export interface LeaderboardEndpoints {
  list(limit?: number, mode?: 'world' | 'power', offset?: number, season?: string): Promise<ApiLeaderboardListResponse>
  find(username: string, mode?: string, season?: string): Promise<unknown>
  seasons(): Promise<ApiLeaderboardSeasonsResponse>
}

export function createLeaderboardEndpoints(http: HttpClient): LeaderboardEndpoints {
  return {
    list: (limit = 10, mode = 'world', offset = 0, season) => http.request('GET', '/api/leaderboard/list', { limit, mode, offset, season }),
    find: (username, mode = 'world', season = '') => http.request('GET', '/api/leaderboard/find', { username, mode, season }),
    seasons: () => http.request('GET', '/api/leaderboard/seasons'),
  }
}
