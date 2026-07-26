import type { HttpClient } from '../HttpClient.js'
import type { ApiLeaderboardFindResponse, ApiLeaderboardListResponse, ApiLeaderboardSeasonsResponse, LeaderboardMode } from '../../types/api.js'

/** Query for a page of the ranking table. All fields are optional; the server
 *  defaults to the current season when `season` is omitted. */
export interface LeaderboardListQuery {
  mode?: LeaderboardMode
  /** Season id (`YYYY-MM`), as returned by `seasons()`. */
  season?: string
  limit?: number
  offset?: number
}

/** A player's placement in one season, normalized across the two response
 *  shapes servers use. `rank` is 0-based, matching the API. */
export interface LeaderboardRank {
  rank: number
  score: number
  season?: string
  user?: string
}

export interface LeaderboardEndpoints {
  list(query?: LeaderboardListQuery): Promise<ApiLeaderboardListResponse>
  /** Omit `season` to get every season the player is ranked in (as `list`). */
  find(username: string, mode?: LeaderboardMode, season?: string): Promise<ApiLeaderboardFindResponse>
  seasons(mode?: LeaderboardMode): Promise<ApiLeaderboardSeasonsResponse>
}

/** The season id (`YYYY-MM`) the server is currently ranking in. Seasons roll
 *  over at UTC midnight, so derive it in UTC — a client in a positive offset
 *  near a month boundary would otherwise ask for a season that doesn't exist. */
export function currentLeaderboardSeason(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Reduce a `find` response to a single placement. Servers answer a
 *  season-scoped query either with the record inline at the top level or as a
 *  one-element `list`; unranked players get an empty list or no rank at all,
 *  which maps to null. */
export function normalizeLeaderboardRank(res: ApiLeaderboardFindResponse | null | undefined): LeaderboardRank | null {
  const rec = res?.list?.[0] ?? res
  if (!rec || typeof rec.rank !== 'number') return null
  return { rank: rec.rank, score: typeof rec.score === 'number' ? rec.score : 0, season: rec.season, user: rec.user }
}

export function createLeaderboardEndpoints(http: HttpClient): LeaderboardEndpoints {
  // Every route here is best-effort: rankings feed public profiles and an
  // optional page, and not all private servers implement them. Callers render
  // their own empty state, so a miss shouldn't raise a user-facing toast.
  return {
    list: ({ mode = 'world', season, limit = 10, offset = 0 } = {}) =>
      http.request('GET', '/api/leaderboard/list', { mode, season, limit, offset }, { silent: true }),
    find: (username, mode = 'world', season) =>
      http.request('GET', '/api/leaderboard/find', { username, mode, season }, { silent: true }),
    seasons: (mode) => http.request('GET', '/api/leaderboard/seasons', { mode }, { silent: true }),
  }
}
