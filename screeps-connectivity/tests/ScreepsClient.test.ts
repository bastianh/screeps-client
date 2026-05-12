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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: 1, token: 'authed' }), {
      headers: { 'content-type': 'application/json' },
    })
  ))
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
})
