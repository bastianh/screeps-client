import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SocketClient } from '../../src/socket/SocketClient.js'

class MockWS {
  static instances: MockWS[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    MockWS.instances.push(this)
  }

  send(data: string) { this.sent.push(data) }
  close() { this.onclose?.() }

  simulateOpen() { this.onopen?.() }
  simulateMessage(data: string) { this.onmessage?.({ data } as MessageEvent) }
  simulateClose() { this.onclose?.() }
}

beforeEach(() => { MockWS.instances = [] })

function makeClient() {
  return new SocketClient({ url: 'http://test.local', WebSocket: MockWS as unknown as typeof WebSocket })
}

async function connectClient(client: SocketClient, token = 'tok') {
  const connectPromise = client.connect(token)
  const ws = MockWS.instances[0]
  ws.simulateOpen()
  ws.simulateMessage('auth ok newtoken')
  await connectPromise
  return ws
}

describe('SocketClient', () => {
  it('connects to the correct WebSocket URL', async () => {
    const client = makeClient()
    const promise = client.connect('tok')
    const ws = MockWS.instances[0]
    expect(ws.url).toBe('ws://test.local/socket/websocket')
    ws.simulateOpen()
    ws.simulateMessage('auth ok tok')
    await promise
  })

  it('sends auth token on open', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    expect(ws.sent).toContain('auth tok')
  })

  it('resolves connect() after auth ok', async () => {
    const client = makeClient()
    await expect(connectClient(client)).resolves.toBeDefined()
  })

  it('subscribe sends subscribe message when authed', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    ws.sent.length = 0
    client.subscribe('room:shard0/W7N7')
    expect(ws.sent).toContain('subscribe room:shard0/W7N7')
  })

  it('subscribe refcounts — subscribe message sent only once for multiple subs', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    ws.sent.length = 0
    client.subscribe('room:shard0/W7N7')
    client.subscribe('room:shard0/W7N7')
    const subscribeMsgs = ws.sent.filter(s => s.startsWith('subscribe'))
    expect(subscribeMsgs).toHaveLength(1)
  })

  it('unsubscribe sent when last subscriber disposes', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const sub1 = client.subscribe('room:shard0/W7N7')
    const sub2 = client.subscribe('room:shard0/W7N7')
    ws.sent.length = 0
    sub1.dispose()
    expect(ws.sent.filter(s => s.startsWith('unsubscribe'))).toHaveLength(0)
    sub2.dispose()
    expect(ws.sent).toContain('unsubscribe room:shard0/W7N7')
  })

  it('on() delivers channel messages to listener', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const handler = vi.fn()
    client.on('user:uid/cpu', handler)
    ws.simulateMessage(JSON.stringify(['user:uid/cpu', { cpu: 25 }]))
    await new Promise(r => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith({ cpu: 25 })
  })

  it('on() subscription dispose removes listener', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    const handler = vi.fn()
    const sub = client.on('user:uid/cpu', handler)
    sub.dispose()
    ws.simulateMessage(JSON.stringify(['user:uid/cpu', { cpu: 25 }]))
    await new Promise(r => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
  })

  it('isConnected reflects state', async () => {
    const client = makeClient()
    expect(client.isConnected).toBe(false)
    await connectClient(client)
    expect(client.isConnected).toBe(true)
    client.disconnect()
    expect(client.isConnected).toBe(false)
    // After intentional disconnect, no reconnect should be attempted
    await new Promise(r => setTimeout(r, 0))
    expect(MockWS.instances).toHaveLength(1)
  })

  it('disconnect() prevents reconnect even when not currently reconnecting', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    client.disconnect()
    // After disconnect, scheduleReconnect should be a no-op
    // We verify by checking no new WS instance is created after a tick
    await new Promise(r => setTimeout(r, 0))
    expect(MockWS.instances).toHaveLength(1)  // only the original one
  })

  it('disconnected event has willReconnect: false when disconnect() is called', async () => {
    const client = makeClient()
    const ws = await connectClient(client)
    let willReconnect: boolean | undefined
    client.on('disconnected', (data) => {
      willReconnect = (data as { willReconnect: boolean }).willReconnect
    })
    client.disconnect()
    expect(willReconnect).toBe(false)
  })
})
