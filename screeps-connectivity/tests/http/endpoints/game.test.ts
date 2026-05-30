import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../../../src/http/HttpClient.js'
import { TokenAuth } from '../../../src/http/auth/TokenAuth.js'

function mockResponse(body: unknown, opts: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...opts.headers },
    ...opts,
  })
}

describe('game endpoints', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createFlag sends POST to /api/game/create-flag', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    await http.game.createFlag('E2N2', 15, 25, 'MyFlag', 1, 2, 'shard1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/game/create-flag')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      room: 'E2N2',
      x: 15,
      y: 25,
      name: 'MyFlag',
      color: 1,
      secondaryColor: 2,
      shard: 'shard1',
    })
  })

  it('createFlag omits shard when not provided', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    await http.game.createFlag('E2N2', 15, 25, 'MyFlag', 1, 2)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      room: 'E2N2',
      x: 15,
      y: 25,
      name: 'MyFlag',
      color: 1,
      secondaryColor: 2,
    })
  })

  it('genUniqueFlagName sends POST to /api/game/gen-unique-flag-name', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1, name: 'Flag1' }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    const res = await http.game.genUniqueFlagName()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/game/gen-unique-flag-name')
    expect(init.method).toBe('POST')
    expect(res.name).toBe('Flag1')
  })

  it('checkUniqueFlagName sends POST to /api/game/check-unique-flag-name', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    await http.game.checkUniqueFlagName('MyFlag')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/game/check-unique-flag-name')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'MyFlag' })
  })

  it('genUniqueObjectName sends POST with type', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1, name: 'Spawn1' }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const res = await http.game.genUniqueObjectName('spawn')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/gen-unique-object-name')
    expect(JSON.parse(init.body as string)).toEqual({ type: 'spawn' })
    expect(res.name).toBe('Spawn1')
  })

  it('checkUniqueObjectName sends POST with type and name', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.checkUniqueObjectName('spawn', 'Spawn1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/check-unique-object-name')
    expect(JSON.parse(init.body as string)).toEqual({ type: 'spawn', name: 'Spawn1' })
  })

  it('placeSpawn sends POST with room, x, y', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.placeSpawn('W1N1', 10, 20)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/place-spawn')
    expect(JSON.parse(init.body as string)).toEqual({ room: 'W1N1', x: 10, y: 20 })
  })

  it('placeSpawn includes name when provided', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.placeSpawn('W1N1', 10, 20, 'Spawn1')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual({ room: 'W1N1', x: 10, y: 20, name: 'Spawn1' })
  })

  it('placeSpawn includes shard when provided', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.placeSpawn('W1N1', 10, 20, 'Spawn1', 'shard0')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual({ room: 'W1N1', x: 10, y: 20, name: 'Spawn1', shard: 'shard0' })
  })

  it('createConstruction sends POST with required fields', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.createConstruction('W1N1', 5, 5, 'extension')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/create-construction')
    expect(JSON.parse(init.body as string)).toEqual({ room: 'W1N1', x: 5, y: 5, structureType: 'extension' })
  })

  it('addObjectIntent sends POST with _id mapping', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.addObjectIntent('obj-id', 'W1N1', 'attack', { targetId: 'x' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/add-object-intent')
    expect(JSON.parse(init.body as string)).toEqual({ _id: 'obj-id', room: 'W1N1', name: 'attack', intent: { targetId: 'x' } })
  })

  it('addGlobalIntent sends POST with name and intent', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.addGlobalIntent('respawn', {})
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/add-global-intent')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'respawn', intent: {} })
  })

  it('setNotifyWhenAttacked sends POST with _id mapping', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.setNotifyWhenAttacked('struct-id', true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/set-notify-when-attacked')
    expect(JSON.parse(init.body as string)).toEqual({ _id: 'struct-id', enabled: true })
  })

  it('createInvader sends POST with required fields', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.createInvader('W1N1', 10, 10, 1, 'melee')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/create-invader')
    expect(JSON.parse(init.body as string)).toEqual({ room: 'W1N1', x: 10, y: 10, size: 1, type: 'melee' })
  })

  it('createInvader includes boosted when provided', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.createInvader('W1N1', 10, 10, 1, 'melee', true)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.boosted).toBe(true)
  })

  it('removeInvader sends POST with _id mapping', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    await http.game.removeInvader('inv-id')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(url).toContain('/api/game/remove-invader')
    expect(JSON.parse(init.body as string)).toEqual({ _id: 'inv-id' })
  })

  it('tick sends GET to /api/game/tick', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: 1, tick: 500 }))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })
    const res = await http.game.tick()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('GET')
    expect(url).toContain('/api/game/tick')
    expect(res.tick).toBe(500)
  })

  it('roomHistory uses path URL for official server (shard provided)', async () => {
    const chunk = { timestamp: 1000, room: 'W1N1', base: 1000, ticks: {} }
    fetchMock.mockResolvedValue(mockResponse(chunk))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    const res = await http.game.roomHistory('W1N1', 1000, 'shard0')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('GET')
    expect(url).toBe('http://test.local/room-history/shard0/W1N1/1000.json')
    expect(res.base).toBe(1000)
  })

  it('roomHistory uses query params for private server (no shard)', async () => {
    const chunk = { timestamp: 1000, room: 'W1N1', base: 1000, ticks: {} }
    fetchMock.mockResolvedValue(mockResponse(chunk))
    const http = new HttpClient({ url: 'http://test.local', auth: new TokenAuth({ token: 't' }) })

    const res = await http.game.roomHistory('W1N1', 1000)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('GET')
    expect(url).toMatch(/\/room-history/)
    expect(url).toContain('room=W1N1')
    expect(url).toContain('time=1000')
    expect(res.base).toBe(1000)
  })
})
