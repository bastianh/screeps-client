import { describe, it, expect, vi } from 'vitest'
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
      roomObjects: vi.fn().mockResolvedValue({ ok: 1, objects: [], users: {} }),
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

  it('deep-merges nested store diffs instead of clobbering the whole store', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')

    // Full state: a storage holding several resources.
    messageHandler({
      objects: { s1: { _id: 's1', type: 'storage', room: 'W7N7', x: 28, y: 26, store: { energy: 239076, power: 2000, H: 5000, L: 5000 } } },
      gameTime: 1000,
    })

    // Diff tick: only energy changed within the store.
    messageHandler({ objects: { s1: { store: { energy: 223706 } } }, gameTime: 1001 })

    // Other resources must survive — a shallow merge would have dropped them.
    expect((store.objects('W7N7', 'shard0')?.['s1'] as { store: Record<string, number> }).store)
      .toEqual({ energy: 223706, power: 2000, H: 5000, L: 5000 })
  })

  it('removes a store resource when the diff sends a null leaf', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')
    messageHandler({ objects: { s1: { _id: 's1', type: 'storage', room: 'W7N7', store: { energy: 100, H: 5000 } } }, gameTime: 1000 })
    messageHandler({ objects: { s1: { store: { H: null } } }, gameTime: 1001 })

    expect((store.objects('W7N7', 'shard0')?.['s1'] as { store: Record<string, number> }).store).toEqual({ energy: 100 })
  })

  it('replaces array fields wholesale rather than merging them', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')
    messageHandler({ objects: { c1: { _id: 'c1', type: 'creep', room: 'W7N7', body: [{ type: 'work' }, { type: 'move' }] } }, gameTime: 1000 })
    messageHandler({ objects: { c1: { body: [{ type: 'carry' }] } }, gameTime: 1001 })

    expect((store.objects('W7N7', 'shard0')?.['c1'] as { body: unknown[] }).body).toEqual([{ type: 'carry' }])
  })

  it('does not mutate a previously returned snapshot when applying a diff', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')
    messageHandler({ objects: { s1: { _id: 's1', type: 'storage', room: 'W7N7', store: { energy: 100, H: 5000 } } }, gameTime: 1000 })
    const before = store.objects('W7N7', 'shard0')?.['s1'] as { store: Record<string, number> }

    messageHandler({ objects: { s1: { store: { energy: 200 } } }, gameTime: 1001 })

    // The snapshot captured before the diff must be unchanged.
    expect(before.store).toEqual({ energy: 100, H: 5000 })
  })

  // actionLog is a transient per-tick field the client reads from merged state to drive
  // action beams. The engine emits explicit `null` when an action stops, so deep-merge must
  // (a) keep an unchanged action across ticks where the diff omits it (continuous beam) and
  // (b) drop it on a null leaf (beam stops) — never accumulate a stale action.
  it('keeps a continuing actionLog entry but clears it on an explicit null', async () => {
    const { store, socket } = makeStore()
    let messageHandler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      messageHandler = cb
      return { dispose: vi.fn() }
    })

    store.subscribe('W7N7', 'shard0')
    // Harvest begins.
    messageHandler({ objects: { c1: { _id: 'c1', type: 'creep', room: 'W7N7', actionLog: { harvest: { x: 5, y: 6 } } } }, gameTime: 1000 })
    // Next tick the source is unchanged, so the diff omits actionLog entirely — the beam must persist.
    messageHandler({ objects: { c1: { fatigue: 0 } }, gameTime: 1001 })
    expect((store.objects('W7N7', 'shard0')?.['c1'] as { actionLog: Record<string, unknown> }).actionLog)
      .toEqual({ harvest: { x: 5, y: 6 } })
    // Creep stops harvesting: the engine sends a null leaf — the entry (and beam) must clear.
    messageHandler({ objects: { c1: { actionLog: { harvest: null } } }, gameTime: 1002 })
    expect((store.objects('W7N7', 'shard0')?.['c1'] as { actionLog: Record<string, unknown> }).actionLog)
      .toEqual({})
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

  it('fetchObjects loads objects via HTTP and emits room:update', async () => {
    const { store, http } = makeStore()
    const mockObjects = [
      { _id: 'o1', type: 'controller', room: 'E9N3', x: 25, y: 25 },
      { _id: 'o2', type: 'source', room: 'E9N3', x: 10, y: 10 },
    ]
    ;(http.game as unknown as { roomObjects: ReturnType<typeof vi.fn> }).roomObjects = vi.fn().mockResolvedValue({ ok: 1, objects: mockObjects, users: {} })

    const eventSpy = vi.fn()
    store.on('room:update', eventSpy)

    await store.fetchObjects('E9N3', 'shard0')

    expect(http.game.roomObjects).toHaveBeenCalledWith('E9N3', 'shard0')
    expect(eventSpy).toHaveBeenCalledOnce()
    const update = eventSpy.mock.calls[0][0] as { objects: Record<string, unknown> }
    expect(update.objects).toHaveProperty('o1')
    expect(update.objects).toHaveProperty('o2')
    expect(update.objects.o1).toEqual(expect.objectContaining({ type: 'controller' }))
  })
})
