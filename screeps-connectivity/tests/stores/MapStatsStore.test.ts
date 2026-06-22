import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MapStatsStore } from '../../src/stores/MapStatsStore.js'
import { HttpClient } from '../../src/http/HttpClient.js'
import { TokenAuth } from '../../src/http/auth/TokenAuth.js'

function mockResponse(body: unknown, opts: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...opts.headers },
    ...opts,
  })
}

describe('MapStatsStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let store: MapStatsStore

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    store = new MapStatsStore(http, 10)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when rooms is empty', () => {
    store.request([], 'owner0')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emits per-room events after fetch', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { own: { user: 'u1', level: 3 } },
      },
      users: { u1: { _id: 'u1', username: 'Alice', badge: { type: 1, color1: '#fff', color2: '#000', color3: '#f00', flip: false } } },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    expect(events[0].room).toBe('W1N1')
    const stat = events[0].stat as { own: { user: string; level: number }; username: string }
    expect(stat.own).toEqual({ user: 'u1', level: 3 })
    expect(stat.username).toBe('Alice')
  })

  it('propagates badge data for room owners', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { own: { user: 'u1', level: 3 } },
      },
      users: {
        u1: {
          _id: 'u1',
          username: 'Alice',
          badge: { type: 24, color1: '#000077', color2: '#5555dd', color3: '#9999ff', param: 0, flip: false },
        },
      },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { badge: { type: number; color1: string } }
    expect(stat.badge).toBeDefined()
    expect(stat.badge.type).toBe(24)
    expect(stat.badge.color1).toBe('#000077')
  })

  it('does not include badge for unowned rooms', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { status: 'normal' },
      },
      users: {},
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { badge?: unknown }
    expect(stat.badge).toBeUndefined()
  })

  it('batches multiple request() calls into one HTTP request', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { own: { user: 'u1', level: 1 } },
        W1N2: { own: { user: 'u2', level: 2 } },
      },
      users: {},
    }))

    store.request(['W1N1'], 'owner0')
    store.request(['W1N2'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledOnce()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.rooms).toContain('W1N1')
    expect(body.rooms).toContain('W1N2')
  })

  it('does not batch calls with different statName or shard', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ ok: 1, stats: {}, users: {} }))
      .mockResolvedValueOnce(mockResponse({ ok: 1, stats: {}, users: {} }))
      .mockResolvedValueOnce(mockResponse({ ok: 1, stats: {}, users: {} }))

    store.request(['W1N1'], 'owner0', 'shard0')
    store.request(['W1N1'], 'owner0', 'shard1')
    store.request(['W1N1'], 'status', 'shard0')

    await new Promise(r => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('emits empty entry for rooms that do not exist on server', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {},
      users: {},
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    expect(events[0].room).toBe('W1N1')
    expect(events[0].stat).not.toHaveProperty('own')
  })

  it('extracts mineral type and density from response', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: {
          own: { user: 'u1', level: 1 },
          minerals0: { type: 'H', density: 4 },
        },
      },
      users: {},
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { mineral: string; density: number }
    expect(stat.mineral).toBe('H')
    expect(stat.density).toBe(4)
  })

  it('extracts safeMode from response', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W9N8: {
          status: 'normal',
          novice: null,
          respawnArea: null,
          openTime: null,
          own: { user: 'u1', level: 2 },
          safeMode: true,
          minerals0: { type: 'O', density: 2 },
        },
      },
      users: { u1: { _id: 'u1', username: 'Alice' } },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W9N8'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { safeMode: boolean; own: { user: string; level: number }; username: string }
    expect(stat.safeMode).toBe(true)
    expect(stat.own).toEqual({ user: 'u1', level: 2 })
    expect(stat.username).toBe('Alice')
  })

  it('omits safeMode when not present in response', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: {
          status: 'normal',
          own: { user: 'u1', level: 1 },
        },
      },
      users: {},
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { safeMode?: boolean }
    expect(stat.safeMode).toBeUndefined()
  })

  it('passes reservations through as own with level 0', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { own: { user: 'u1', level: 0 } },
      },
      users: { u1: { _id: 'u1', username: 'Alice' } },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { own: { user: string; level: number }; username: string }
    expect(stat.own).toEqual({ user: 'u1', level: 0 })
    expect(stat.username).toBe('Alice')
  })

  it('resolves the controller sign with the signer username and badge', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: {
          own: { user: 'u1', level: 5 },
          sign: { user: 'u1', text: 'Territory of Alice', time: 100, datetime: 1700000000000 },
        },
      },
      users: {
        u1: { _id: 'u1', username: 'Alice', badge: { type: 7, color1: '#fff', color2: '#000', color3: '#f00', flip: false } },
      },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { sign: { user: string; text: string; datetime: number; username: string; badge: { type: number } } }
    expect(stat.sign.user).toBe('u1')
    expect(stat.sign.text).toBe('Territory of Alice')
    expect(stat.sign.datetime).toBe(1700000000000)
    expect(stat.sign.username).toBe('Alice')
    expect(stat.sign.badge.type).toBe(7)
  })

  it('keeps the raw signer id but omits username/badge when the signer is not in the user map', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: {
          own: { user: 'u1', level: 4 },
          sign: { user: 'ghost', text: 'Was here', time: 5, datetime: 1700000000000 },
        },
      },
      users: { u1: { _id: 'u1', username: 'Alice' } },
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { sign: { user: string; text: string; username?: string; badge?: unknown } }
    expect(stat.sign.user).toBe('ghost')
    expect(stat.sign.text).toBe('Was here')
    expect(stat.sign.username).toBeUndefined()
    expect(stat.sign.badge).toBeUndefined()
  })

  it('omits sign when not present in response', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: 1,
      stats: {
        W1N1: { own: { user: 'u1', level: 1 } },
      },
      users: {},
    }))

    const events: Array<{ room: string; stat: unknown }> = []
    store.on('mapStats:room', (e) => events.push(e))

    store.request(['W1N1'], 'owner0')

    await new Promise(r => setTimeout(r, 50))
    expect(events).toHaveLength(1)
    const stat = events[0].stat as { sign?: unknown }
    expect(stat.sign).toBeUndefined()
  })
})
