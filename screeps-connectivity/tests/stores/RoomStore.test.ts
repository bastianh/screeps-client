import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoomStore } from '../../src/stores/RoomStore.js'
import { Cache } from '../../src/cache/Cache.js'
import { TerrainType } from '../../src/types/game.js'

function makeStore() {
  const http = {
    game: {
      roomTerrain: vi.fn().mockResolvedValue({
        ok: 1,
        terrain: [{ _id: 'id', room: 'W7N7', terrain: '0'.repeat(2500), type: 'terrain' }],
      }),
    },
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    subscribe: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  const cache = new Cache('test', null)
  const store = new RoomStore(http, socket, cache)
  return { store, http, socket, cache }
}

describe('RoomStore', () => {
  it('fetches terrain from API on first call', async () => {
    const { store, http } = makeStore()
    const terrain = await store.terrain('W7N7', 'shard0')
    expect(http.game.roomTerrain).toHaveBeenCalledWith('W7N7', 'shard0')
    expect(terrain.get(0, 0)).toBe(TerrainType.Plain)
  })

  it('returns cached terrain on second call', async () => {
    const { store, http } = makeStore()
    await store.terrain('W7N7', 'shard0')
    await store.terrain('W7N7', 'shard0')
    expect(http.game.roomTerrain).toHaveBeenCalledOnce()
  })

  it('objects() returns null before any subscription updates', () => {
    const { store } = makeStore()
    expect(store.objects('W7N7', 'shard0')).toBeNull()
  })

  it('subscribe() calls socket.subscribe with the correct channel', () => {
    const { store, socket } = makeStore()
    store.subscribe('W7N7', 'shard0')
    expect(socket.subscribe).toHaveBeenCalledWith('room:shard0/W7N7')
  })

  it('subscribe() omits shard prefix when shard is null (private server)', () => {
    const { store, socket } = makeStore()
    store.subscribe('E9N3', null)
    expect(socket.subscribe).toHaveBeenCalledWith('room:E9N3')
  })

  it('subscribe() returns a Subscription with dispose()', () => {
    const { store } = makeStore()
    const sub = store.subscribe('W7N7', 'shard0')
    expect(typeof sub.dispose).toBe('function')
  })

  it('merges room object diff on WS updates', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')

    // First message: full state
    messageHandler({
      objects: { id1: { _id: 'id1', type: 'creep', room: 'W7N7', x: 10, y: 10 } },
      gameTime: 1000,
    })

    expect(store.objects('W7N7', 'shard0')).toMatchObject({
      id1: { _id: 'id1', type: 'creep' },
    })

    // Second message: diff
    messageHandler({
      objects: { id1: { x: 11, y: 11 } },
      gameTime: 1001,
    })

    expect(store.objects('W7N7', 'shard0')?.['id1']).toMatchObject({ x: 11, y: 11, type: 'creep' })
  })

  it('emits room:update event on WS message', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    const handler = vi.fn()
    store.on('room:update', handler)
    store.subscribe('W7N7', 'shard0')
    messageHandler({ objects: {}, gameTime: 2000 })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ room: 'W7N7', shard: 'shard0', gameTime: 2000 }))
  })
})
