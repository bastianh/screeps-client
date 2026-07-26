import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../../../src/http/HttpClient.js'
import { TokenAuth } from '../../../src/http/auth/TokenAuth.js'
import { currentLeaderboardSeason, normalizeLeaderboardRank } from '../../../src/http/endpoints/leaderboard.js'

function mockResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('leaderboard endpoints', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let http: HttpClient

  beforeEach(() => {
    // A fresh Response per call — a shared one can only be read once.
    fetchMock = vi.fn().mockImplementation(() => Promise.resolve(mockResponse({ ok: 1 })))
    vi.stubGlobal('fetch', fetchMock)
    http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('list defaults to the first page of the world ranking', async () => {
    await http.leaderboard.list()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('GET')
    expect(url).toContain('/api/leaderboard/list')
    expect(url).toContain('mode=world')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=0')
    // Omitted so the server picks the running season.
    expect(url).not.toContain('season=')
  })

  it('list sends the full query when given one', async () => {
    await http.leaderboard.list({ mode: 'power', season: '2026-07', limit: 20, offset: 40 })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('mode=power')
    expect(url).toContain('season=2026-07')
    expect(url).toContain('limit=20')
    expect(url).toContain('offset=40')
  })

  it('find omits season so every ranked season comes back', async () => {
    await http.leaderboard.find('Tigga')
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/api/leaderboard/find')
    expect(url).toContain('username=Tigga')
    expect(url).toContain('mode=world')
    expect(url).not.toContain('season=')
  })

  it('find scopes to one season when given one', async () => {
    await http.leaderboard.find('Tigga', 'power', '2026-07')
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('mode=power')
    expect(url).toContain('season=2026-07')
  })

  it('seasons sends mode only when given', async () => {
    await http.leaderboard.seasons()
    expect(fetchMock.mock.calls[0][0]).not.toContain('mode=')
    await http.leaderboard.seasons('power')
    expect(fetchMock.mock.calls[1][0]).toContain('mode=power')
  })
})

describe('currentLeaderboardSeason', () => {
  it('formats the season id as YYYY-MM in UTC', () => {
    expect(currentLeaderboardSeason(new Date('2026-07-25T12:00:00Z'))).toBe('2026-07')
  })

  it('uses the UTC month across a local month boundary', () => {
    // 23:30 UTC on the 31st is already the next month in UTC+2, but the season
    // that is still being ranked is July.
    expect(currentLeaderboardSeason(new Date('2026-07-31T23:30:00Z'))).toBe('2026-07')
  })
})

describe('normalizeLeaderboardRank', () => {
  it('reads a record returned at the top level', () => {
    expect(normalizeLeaderboardRank({ ok: 1, rank: 4, score: 1250, season: '2026-07', user: 'u1' }))
      .toEqual({ rank: 4, score: 1250, season: '2026-07', user: 'u1' })
  })

  it('reads a record returned as a one-element list', () => {
    expect(normalizeLeaderboardRank({ ok: 1, list: [{ season: '2026-07', rank: 0, score: 9, user: 'u1' }] }))
      .toEqual({ rank: 0, score: 9, season: '2026-07', user: 'u1' })
  })

  it('returns null for an unranked player or a missing response', () => {
    expect(normalizeLeaderboardRank({ ok: 1, list: [] })).toBeNull()
    expect(normalizeLeaderboardRank({ ok: 1 })).toBeNull()
    expect(normalizeLeaderboardRank(null)).toBeNull()
  })

  it('defaults a missing score to zero', () => {
    expect(normalizeLeaderboardRank({ ok: 1, rank: 7 })).toEqual({ rank: 7, score: 0, season: undefined, user: undefined })
  })
})
