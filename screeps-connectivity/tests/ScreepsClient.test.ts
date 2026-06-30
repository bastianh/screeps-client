import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScreepsClient } from '../src/ScreepsClient.js'
import { TokenAuth } from '../src/http/auth/TokenAuth.js'

class MockWS {
  static instances: MockWS[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  sent: string[] = []
  constructor() { MockWS.instances.push(this) }
  send(d: string) { this.sent.push(d) }
  close() {}
  simulateOpen() { this.onopen?.() }
  simulateMessage(d: string) { this.onmessage?.({ data: d } as MessageEvent) }
}

beforeEach(() => {
  MockWS.instances = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const path = new URL(url).pathname

    if (path === '/api/user/world-status') {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: 1, status: 'normal' }), {
          headers: { 'content-type': 'application/json' },
        })
      )
    }

    return Promise.resolve(
      new Response(JSON.stringify({ ok: 1, token: 'authed', _id: 'uid1', username: 'user', serverData: { features: [], shards: [] } }), {
        headers: { 'content-type': 'application/json' },
      })
    )
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ScreepsClient', () => {
  it('exposes http, socket, and stores properties', () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    expect(client.http).toBeDefined()
    expect(client.socket).toBeDefined()
    expect(client.stores.room).toBeDefined()
    expect(client.stores.user).toBeDefined()
    expect(client.stores.server).toBeDefined()
    expect(client.stores.map).toBeDefined()
  })

  it('connect() authenticates then opens WebSocket', async () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    const connectPromise = client.connect()
    await new Promise(r => setTimeout(r, 0))
    const ws = MockWS.instances[0]
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await connectPromise
    expect(client.isConnected).toBe(true)
  })

  it('isConnected is false before connect()', () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })
    expect(client.isConnected).toBe(false)
  })

  it('connect() fetches user info, world status, and server version', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })

    const connectPromise = client.connect()
    await new Promise(r => setTimeout(r, 0))
    const ws = MockWS.instances[0]
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await connectPromise

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).toContain('/api/auth/me')
    expect(paths).toContain('/api/user/world-status')
    expect(paths).toContain('/api/version')
    expect(client.stores.user.worldStatusValue).toBe('normal')
  })
})

// Dynamic-token auth strategy (supportsTokenRefresh defaults to true) used for token-rotation tests.
const dynamicAuth = (initial = 'initial') => ({ authenticate: async () => initial })

describe('ScreepsClient — token sync', () => {
  it('rotates SocketClient token when an HTTP response carries x-token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), {
        headers: { 'content-type': 'application/json', 'x-token': 'http-rotated-token' },
      })
    ))

    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: dynamicAuth(),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
      tokenRefresh: false,
    })

    const socketSetToken = vi.spyOn(client.socket, 'setToken')
    await client.http.request('GET', '/api/auth/me')

    expect(socketSetToken).toHaveBeenCalledWith('http-rotated-token')
  })

  it('rotates HttpClient token when WS auth response carries a new token', async () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: dynamicAuth(),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
      tokenRefresh: false,
    })

    const httpSetToken = vi.spyOn(client.http, 'setToken')

    const connectPromise = client.connect()
    await new Promise(r => setTimeout(r, 0))
    const ws = MockWS.instances[0]
    ws.simulateOpen()
    ws.simulateMessage('auth ok ws-rotated-token')
    await connectPromise

    expect(httpSetToken).toHaveBeenCalledWith('ws-rotated-token')
    expect(client.http.token).toBe('ws-rotated-token')
  })

  it('does NOT sync tokens when using TokenAuth (static token)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), {
        headers: { 'content-type': 'application/json', 'x-token': 'server-issued' },
      })
    ))

    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'my-static-token' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
    })

    const socketSetToken = vi.spyOn(client.socket, 'setToken')
    await client.http.request('GET', '/api/auth/me')

    expect(socketSetToken).not.toHaveBeenCalled()
  })
})

describe('ScreepsClient — world status polling', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function buildConnected(opts: { tokenRefresh?: { intervalMs?: number } | false } = {}) {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: dynamicAuth('tok'),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
      tokenRefresh: opts.tokenRefresh,
    })
    const connectPromise = client.connect()
    await vi.advanceTimersByTimeAsync(0)
    const ws = MockWS.instances[0]
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await connectPromise
    return client
  }

  it('polls world-status on a fixed interval', async () => {
    const client = await buildConnected({ tokenRefresh: { intervalMs: 1_000 } })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    await vi.advanceTimersByTimeAsync(1_000)

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).toContain('/api/user/world-status')

    client.disconnect()
  })

  it('polls world-status even while other HTTP traffic is ongoing', async () => {
    const client = await buildConnected({ tokenRefresh: { intervalMs: 1_000 } })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    // Continuous HTTP traffic every 200ms should not suppress the fixed poll.
    for (let i = 0; i < 6; i++) {
      await client.http.request('GET', '/api/version')
      await vi.advanceTimersByTimeAsync(200)
    }

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).toContain('/api/user/world-status')

    client.disconnect()
  })

  it('does not start the refresh timer when tokenRefresh is false', async () => {
    const client = await buildConnected({ tokenRefresh: false })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    await vi.advanceTimersByTimeAsync(60_000)

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).not.toContain('/api/user/world-status')

    client.disconnect()
  })

  it('still polls world-status when using TokenAuth (token is never replaced)', async () => {
    const client = new ScreepsClient({
      url: 'http://test.local',
      auth: new TokenAuth({ token: 'tok' }),
      storage: null,
      WebSocket: MockWS as unknown as typeof WebSocket,
      tokenRefresh: { intervalMs: 1_000 },
    })
    const connectPromise = client.connect()
    await vi.advanceTimersByTimeAsync(0)
    const ws = MockWS.instances[MockWS.instances.length - 1]
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await connectPromise

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()
    await vi.advanceTimersByTimeAsync(1_500)

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).toContain('/api/user/world-status')
    // Token must not have changed despite the response
    expect(client.http.token).toBe('tok')
    client.disconnect()
  })

  it('stops the refresh timer on disconnect()', async () => {
    const client = await buildConnected({ tokenRefresh: { intervalMs: 1_000 } })
    client.disconnect()

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    await vi.advanceTimersByTimeAsync(5_000)

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname)
    expect(paths).not.toContain('/api/user/world-status')
  })
})
