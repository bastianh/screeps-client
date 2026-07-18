import { describe, it, expect, vi } from 'vitest'
import { UserStore } from '../../src/stores/UserStore.js'
import { Cache } from '../../src/cache/Cache.js'
import type { UserInfo } from '../../src/types/game.js'

const mockUser: UserInfo = { _id: 'uid1', username: 'user', email: 'a@b.com', cpu: 20, gcl: 100, credits: 50, badge: { type: 1, color1: '#fff', color2: '#000', color3: '#f00', param: 0, flip: false } }

function makeStore() {
  const http = {
    auth: { me: vi.fn().mockResolvedValue({ ...mockUser, ok: 1 }) },
    user: { worldStatus: vi.fn().mockResolvedValue({ ok: 1, status: 'normal' }) },
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    subscribe: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  const cache = new Cache('test', null)
  return { store: new UserStore(http, socket, cache), http, socket }
}

describe('UserStore', () => {
  it('fetches user info from API', async () => {
    const { store } = makeStore()
    const user = await store.me()
    expect(user.username).toBe('user')
  })

  it('fetches world status from API and emits event', async () => {
    const { store, http } = makeStore()
    const events: Array<{ status: string }> = []
    store.on('user:worldStatus', e => events.push(e))

    const status = await store.worldStatus()

    expect(status).toBe('normal')
    expect(store.worldStatusValue).toBe('normal')
    expect(http.user.worldStatus).toHaveBeenCalledOnce()
    expect(events).toEqual([{ status: 'normal' }])
  })

  it('caches world status after first fetch', async () => {
    const { store, http } = makeStore()

    await store.worldStatus()
    await store.worldStatus()

    expect(http.user.worldStatus).toHaveBeenCalledOnce()
  })

  it('refreshWorldStatus() bypasses cached world status', async () => {
    const { store, http } = makeStore()

    await store.worldStatus()
    ;(http.user.worldStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: 1, status: 'lost' })
    const status = await store.refreshWorldStatus()

    expect(status).toBe('lost')
    expect(http.user.worldStatus).toHaveBeenCalledTimes(2)
  })

  it('caches user info after first fetch', async () => {
    const { store, http } = makeStore()
    await store.me()
    await store.me()
    expect(http.auth.me).toHaveBeenCalledOnce()
  })

  it('deduplicates concurrent me() calls', async () => {
    const { store, http } = makeStore()
    let resolveMe: (value: unknown) => void = () => {}
    ;(http.auth.me as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(r => { resolveMe = r }))

    const p1 = store.me()
    const p2 = store.me()
    const p3 = store.me()

    resolveMe({ ...mockUser, ok: 1 })

    const [u1, u2, u3] = await Promise.all([p1, p2, p3])
    expect(u1).toEqual(u2)
    expect(u2).toEqual(u3)
    expect(http.auth.me).toHaveBeenCalledOnce()
  })

  it('subscribe cpu starts WS subscription with userId prefix', async () => {
    const { store, socket } = makeStore()
    await store.me() // preload user id
    store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0)) // let async userId lookup settle
    expect(socket.subscribe).toHaveBeenCalledWith('user:uid1/cpu')
  })

  it('cpu stats are updated via WS and event fired', async () => {
    const { store, socket } = makeStore()
    await store.me()
    let handler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      handler = cb
      return { dispose: vi.fn() }
    })
    const eventSpy = vi.fn()
    store.on('user:cpu', eventSpy)
    store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0))
    handler({ cpu: 42, memory: 1024 })
    expect(store.cpu).toEqual({ cpu: 42, memory: 1024 })
    expect(eventSpy).toHaveBeenCalledWith({ cpu: 42, memory: 1024 })
  })

  it('console messages accumulate and emit event', async () => {
    const { store, socket } = makeStore()
    await store.me()
    let handler: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      handler = cb
      return { dispose: vi.fn() }
    })
    store.subscribe('console')
    await new Promise(r => setTimeout(r, 0))
    handler({ messages: { log: ['line1'], results: [] } })
    expect(store.console).toHaveLength(1)
  })

  it('dispose() stops WS subscription', async () => {
    const { store, socket } = makeStore()
    await store.me()
    const mockDispose = vi.fn()
    ;(socket.subscribe as ReturnType<typeof vi.fn>).mockReturnValue({ dispose: mockDispose })
    const sub = store.subscribe('cpu')
    await new Promise(r => setTimeout(r, 0))
    sub.dispose()
    expect(mockDispose).toHaveBeenCalled()
  })

  it('multiple console subscribers share one socket listener and do not double output', async () => {
    const { store, socket } = makeStore()
    await store.me()
    const handlers: Array<(data: unknown) => void> = []
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      handlers.push(cb)
      return { dispose: vi.fn() }
    })
    const eventSpy = vi.fn()
    store.on('user:console', eventSpy)

    // Two independent parts of the app subscribe to the same channel (e.g. the console panel and the
    // custom-UI store). Regression: this used to install two socket listeners, doubling every frame.
    store.subscribe('console')
    store.subscribe('console')
    await new Promise(r => setTimeout(r, 0))

    // Exactly one socket listener and one server subscription regardless of caller count.
    expect(handlers).toHaveLength(1)
    expect(socket.subscribe).toHaveBeenCalledTimes(1)

    // One incoming frame produces exactly one console entry and one event.
    handlers[0]!({ messages: { log: ['line1'], results: [] } })
    expect(store.console).toHaveLength(1)
    expect(eventSpy).toHaveBeenCalledTimes(1)
  })

  it('console socket subscription is ref-counted and dropped only after the last subscriber', async () => {
    const { store, socket } = makeStore()
    await store.me()
    const mockDispose = vi.fn()
    ;(socket.subscribe as ReturnType<typeof vi.fn>).mockReturnValue({ dispose: mockDispose })

    const a = store.subscribe('console')
    const b = store.subscribe('console')
    await new Promise(r => setTimeout(r, 0))
    expect(socket.subscribe).toHaveBeenCalledTimes(1)

    a.dispose()
    expect(mockDispose).not.toHaveBeenCalled() // second subscriber still active

    b.dispose()
    expect(mockDispose).toHaveBeenCalledTimes(1)
  })
})
