import { describe, it, expect, vi } from 'vitest'
import { UserStore } from '../../src/stores/UserStore.js'
import { Cache } from '../../src/cache/Cache.js'
import type { UserInfo } from '../../src/types/game.js'

const mockUser: UserInfo = { _id: 'uid1', username: 'user', email: 'a@b.com', cpu: 20, gcl: 100, credits: 50, badge: { type: 1, color1: '#fff', color2: '#000', color3: '#f00', param: 0, flip: false } }

function makeStore() {
  const http = {
    auth: { me: vi.fn().mockResolvedValue({ ...mockUser, ok: 1 }) },
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

  it('caches user info after first fetch', async () => {
    const { store, http } = makeStore()
    await store.me()
    await store.me()
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
})
