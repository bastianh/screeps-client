import type { HttpClient } from '../HttpClient.js'
import type {
  ApiUserBranchesResponse,
  ApiUserFindResponse,
  ApiUserMoneyHistoryResponse,
  ApiUserOverviewResponse,
  ApiUserRoomsResponse,
} from '../../types/api.js'
import type { NotifyPrefs } from '../../types/game.js'
import { createUserMessagesEndpoints, type UserMessagesEndpoints } from './user-messages.js'

export interface UserEndpoints {
  branches(): Promise<ApiUserBranchesResponse>
  code: {
    get(branch?: string): Promise<unknown>
    set(branch: string, modules: Record<string, string>): Promise<unknown>
  }
  memory: {
    get(path: string, shard?: string | null): Promise<{ ok: number; data: unknown }>
    set(path: string, value: unknown, shard?: string | null): Promise<unknown>
    segment: {
      get(segment: number, shard?: string | null): Promise<{ ok: number; data: string }>
      set(segment: number, data: string, shard?: string | null): Promise<unknown>
    }
  }
  console(expression: string, shard?: string | null): Promise<unknown>
  stats(interval: number): Promise<unknown>
  rooms(id: string): Promise<ApiUserRoomsResponse>
  overview(interval: number, statName: string): Promise<ApiUserOverviewResponse>
  worldStatus(): Promise<{ ok: number; status: 'normal' | 'lost' | 'empty' }>
  worldStartRoom(shard?: string | null): Promise<unknown>
  find(query: { username: string } | { id: string }): Promise<ApiUserFindResponse>
  moneyHistory(page?: number): Promise<ApiUserMoneyHistoryResponse>
  respawn(): Promise<{ ok: number }>
  respawnProhibitedRooms(): Promise<{ ok: number; rooms: string[] }>
  badge(badge: unknown): Promise<{ ok: number }>
  setActiveBranch(activeName: 'activeWorld' | 'activeSim', branch: string): Promise<{ ok: number }>
  cloneBranch(newName: string, branch?: string, defaultModules?: boolean): Promise<{ ok: number }>
  deleteBranch(branch: string): Promise<{ ok: number }>
  notifyPrefs(prefs: Partial<NotifyPrefs>): Promise<{ ok: number }>
  tutorialDone(): Promise<{ ok: number }>
  email(email: string): Promise<{ ok: number }>
  setSteamVisible(visible: boolean): Promise<{ ok: number }>
  /** Change the current user's password (screepsmod-auth private servers only). Pass oldPassword when the account already has a password set. */
  password(newPassword: string, oldPassword?: string): Promise<{ ok: number }>
  messages: UserMessagesEndpoints
}

function withShard(params: Record<string, unknown>, shard?: string | null): Record<string, unknown> {
  if (shard) params.shard = shard
  return params
}

export function createUserEndpoints(http: HttpClient): UserEndpoints {
  return {
    branches: () => http.request('GET', '/api/user/branches'),
    code: {
      get: (branch) => http.request('GET', '/api/user/code', branch ? { branch } : {}),
      set: (branch, modules) => http.request('POST', '/api/user/code', { branch, modules, _hash: Date.now() }),
    },
    memory: {
      get: (path, shard) => http.request('GET', '/api/user/memory', withShard({ path }, shard)),
      set: (path, value, shard) => http.request('POST', '/api/user/memory', withShard({ path, value }, shard)),
      segment: {
        get: (segment, shard) => http.request('GET', '/api/user/memory-segment', withShard({ segment }, shard)),
        set: (segment, data, shard) => http.request('POST', '/api/user/memory-segment', withShard({ segment, data }, shard)),
      },
    },
    console: (expression, shard) => http.request('POST', '/api/user/console', withShard({ expression }, shard)),
    stats: (interval) => http.request('GET', '/api/user/stats', { interval }),
    // Best-effort dashboard data: not every server implements these, and the
    // Overview page degrades gracefully (zeros / no tiles), so a failure here
    // shouldn't raise a user-facing error toast — mark them silent.
    rooms: (id) => http.request('GET', '/api/user/rooms', { id }, { silent: true }),
    overview: (interval, statName) => http.request('GET', '/api/user/overview', { interval, statName }, { silent: true }),
    worldStatus: () => http.request('GET', '/api/user/world-status'),
    worldStartRoom: (shard) => http.request('GET', '/api/user/world-start-room', withShard({}, shard)),
    find: (query) => http.request('GET', '/api/user/find', query as Record<string, unknown>),
    moneyHistory: (page) => http.request('GET', '/api/user/money-history', page != null ? { page } : {}),
    respawn: () => http.request('POST', '/api/user/respawn'),
    respawnProhibitedRooms: () => http.request('GET', '/api/user/respawn-prohibited-rooms'),
    badge: (badge) => http.request('POST', '/api/user/badge', { badge }),
    setActiveBranch: (activeName, branch) => http.request('POST', '/api/user/set-active-branch', { activeName, branch }),
    cloneBranch: (newName, branch, defaultModules) => http.request('POST', '/api/user/clone-branch', { newName, ...(branch ? { branch } : {}), ...(defaultModules != null ? { defaultModules } : {}) }),
    deleteBranch: (branch) => http.request('POST', '/api/user/delete-branch', { branch }),
    notifyPrefs: (prefs) => http.request('POST', '/api/user/notify-prefs', prefs as Record<string, unknown>),
    tutorialDone: () => http.request('POST', '/api/user/tutorial-done'),
    email: (email) => http.request('POST', '/api/user/email', { email }),
    setSteamVisible: (visible) => http.request('POST', '/api/user/set-steam-visible', { visible }),
    password: (newPassword, oldPassword) => http.request('POST', '/api/user/password', { password: newPassword, ...(oldPassword != null ? { oldPassword } : {}) }),
    messages: createUserMessagesEndpoints(http),
  }
}
