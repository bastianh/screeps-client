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
    // passport-token requires both x-token and x-username; server ignores the username value
    expect(headers['X-Username']).toBe('tok123')
  })

  it('attaches X-Server-Password header when serverPassword is set', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }), serverPassword: 'secret' })
    await http.request('GET', '/api/version')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Server-Password']).toBe('secret')
  })

  it('omits X-Server-Password header when serverPassword is not set', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.request('GET', '/api/version')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Server-Password']).toBeUndefined()
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
    // Use a plain object (supportsTokenRefresh defaults to true) to verify rotation works for dynamic-token strategies
    const http = new HttpClient({ url: 'http://test.local', auth: { authenticate: async () => 'old' } })
    http.token = 'old'
    await http.request('GET', '/api/version')
    expect(http.token).toBe('refreshed')
  })

  it('does NOT update token from x-token header when using TokenAuth (static token)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'server-issued' },
    }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'my-static-token' }) })
    http.token = 'my-static-token'
    await http.request('GET', '/api/version')
    expect(http.token).toBe('my-static-token')
  })

  it('DOES update token from x-token header when TokenAuth opts into refresh (session token)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'rotated' },
    }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'session-token', supportsTokenRefresh: true }) })
    http.token = 'session-token'
    await http.request('GET', '/api/version')
    expect(http.token).toBe('rotated')
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

  it('throws immediately on 401 during authenticate() — no recursion', async () => {
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    const badAuth = {
      authenticate: (http: HttpClient) => http.request<{ token: string }>('POST', '/api/auth/signin', { email: 'x', password: 'wrong' }).then(r => r.token),
    }
    const http = new HttpClient({ url: 'http://test.local', auth: badAuth })
    await expect(http.authenticate()).rejects.toThrow('HTTP 401')
    // fetchMock called exactly once — no retry loop
    expect(fetchMock).toHaveBeenCalledOnce()
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

  it('emits http:tokenRefresh when x-token header is present', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'new-tok' },
    }))
    // Use a plain object (supportsTokenRefresh defaults to true) to verify the event fires for dynamic-token strategies
    const http = new HttpClient({ url: 'http://test.local', auth: { authenticate: async () => 'old' } })
    const handler = vi.fn()
    http.on('http:tokenRefresh', handler)
    await http.request('GET', '/api/version')
    expect(handler).toHaveBeenCalledWith({ token: 'new-tok' })
  })

  it('does NOT emit http:tokenRefresh when using TokenAuth (static token)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }, {
      headers: { 'content-type': 'application/json', 'x-token': 'server-issued' },
    }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 'my-static-token' }) })
    const handler = vi.fn()
    http.on('http:tokenRefresh', handler)
    await http.request('GET', '/api/version')
    expect(handler).not.toHaveBeenCalled()
  })

  it('emits http:success on 200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const handler = vi.fn()
    http.on('http:success', handler)
    await http.request('GET', '/api/version')
    expect(handler).toHaveBeenCalledWith({ method: 'GET', path: '/api/version', status: 200 })
  })

  it('emits http:error on non-2xx response', async () => {
    fetchMock.mockResolvedValue(new Response('Server Error', { status: 500 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const handler = vi.fn()
    http.on('http:error', handler)
    await expect(http.request('GET', '/api/version')).rejects.toThrow('HTTP 500')
    expect(handler).toHaveBeenCalledOnce()
    const arg = handler.mock.calls[0][0]
    expect(arg.method).toBe('GET')
    expect(arg.path).toBe('/api/version')
    expect(arg.status).toBe(500)
    expect(arg.error).toBeInstanceOf(Error)
  })

  it('throws on 200 with error in response body', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 0, error: 'invalid params' }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await expect(http.request('GET', '/api/game/create-flag')).rejects.toThrow('Screeps API error: invalid params')
  })

  it('treats the xxscreeps "actually, it was fine" sentinel as success', async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: 'actually, it was fine' }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const errorHandler = vi.fn()
    http.on('http:error', errorHandler)
    const res = await http.request<{ error?: string }>('POST', '/api/game/create-construction')
    expect(res.error).toBeUndefined()
    expect(errorHandler).not.toHaveBeenCalled()
  })

  it('emits http:error on 200 with error in response body', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 0, error: 'flags limit exceeded' }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const handler = vi.fn()
    http.on('http:error', handler)
    await expect(http.request('POST', '/api/game/create-flag')).rejects.toThrow('Screeps API error: flags limit exceeded')
    expect(handler).toHaveBeenCalledOnce()
    const arg = handler.mock.calls[0][0]
    expect(arg.method).toBe('POST')
    expect(arg.path).toBe('/api/game/create-flag')
    expect(arg.status).toBe(200)
    expect(arg.error).toBeInstanceOf(Error)
  })
})
