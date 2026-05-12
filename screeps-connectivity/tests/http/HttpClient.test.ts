import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../../src/http/HttpClient.js'
import { TokenAuth } from '../../src/http/auth/TokenAuth.js'

function mockResponse(body: unknown, opts: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...opts.headers },
    ...opts,
  })
}

describe('HttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches X-Token and X-Username headers after authenticate()', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'tok123' }) })
    await http.authenticate()
    await http.request('GET', '/api/version')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Token']).toBe('tok123')
    expect(headers['X-Username']).toBe('tok123')
  })

  it('sends GET params as query string', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('GET', '/api/game/time', { shard: 'shard0' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('shard=shard0')
  })

  it('omits null GET params from query string', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('GET', '/api/game/time', { shard: null, room: 'E9N3' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).not.toContain('shard')
    expect(url).toContain('room=E9N3')
  })

  it('sends POST body as JSON', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('POST', '/api/user/console', { expression: 'Game.time', shard: 'shard0' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ expression: 'Game.time', shard: 'shard0' })
  })

  it('updates token from x-token response header', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'refreshed' },
    }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'old' }) })
    http.token = 'old'
    await http.request('GET', '/api/version')
    expect(http.token).toBe('refreshed')
  })

  it('retries once on 401 after re-authenticating', async () => {
    let calls = 0
    fetchMock.mockImplementation(() => {
      calls++
      if (calls === 1) return Promise.resolve(new Response('Unauthorized', { status: 401 }))
      return Promise.resolve(mockResponse({ ok: 1 }))
    })
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'tok' }) })
    http.token = 'tok'
    await http.request('GET', '/api/version')
    expect(calls).toBe(2)
  })

  it('does not retry a second time if re-auth 401 persists', async () => {
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'tok' }) })
    http.token = 'tok'
    await expect(http.request('GET', '/api/version')).rejects.toThrow('HTTP 401')
  })

  it('throws on non-401 error status', async () => {
    fetchMock.mockResolvedValue(new Response('Server Error', { status: 500 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await expect(http.request('GET', '/api/version')).rejects.toThrow('HTTP 500')
  })

  it('decompresses gz: data field', async () => {
    // Non-gz response data passes through unchanged
    fetchMock.mockResolvedValue(mockResponse({ ok: 1, data: { result: 42 } }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const res = await http.request<{ ok: number; data: { result: number } }>('GET', '/api/test')
    expect(res.data.result).toBe(42)
  })
})
