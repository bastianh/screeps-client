import { describe, it, expect, vi } from 'vitest'
import { ServerStore } from '../../src/stores/ServerStore.js'
import { Cache } from '../../src/cache/Cache.js'
import type { ApiVersionResponse } from '../../src/types/api.js'

const mockVersion: ApiVersionResponse = { ok: 1, package: 5, protocol: 13, users: 100, serverData: { historyChunkSize: 20, features: [], shards: ['shard0'] } }

function makeStore() {
  const http = {
    request: vi.fn().mockResolvedValue({ ...mockVersion }),
  } as unknown as import('../../src/http/HttpClient.js').HttpClient

  const socket = {
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as import('../../src/socket/SocketClient.js').SocketClient

  return { store: new ServerStore(http, socket, new Cache('test', null)), http, socket }
}

describe('ServerStore', () => {
  it('fetches server version', async () => {
    const { store } = makeStore()
    const v = await store.version()
    expect(v.protocol).toBe(13)
  })

  it('caches version after first fetch', async () => {
    const { store, http } = makeStore()
    await store.version()
    await store.version()
    expect(http.request).toHaveBeenCalledOnce()
  })

  it('serves a seeded version without fetching and emits server:version', async () => {
    const { store, http } = makeStore()
    const spy = vi.fn()
    store.on('server:version', spy)
    store.seedVersion({ ...mockVersion })
    const v = await store.version()
    expect(v.protocol).toBe(13)
    expect(http.request).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ protocol: 13 }))
    expect(store.versionInfo?.protocol).toBe(13)
  })

  it('emits server:connected when socket fires connected event', () => {
    const { socket } = makeStore()
    let connectedCb: (data: unknown) => void = () => {}
    ;(socket.on as ReturnType<typeof vi.fn>).mockImplementation((ch: string, cb: (data: unknown) => void) => {
      if (ch === 'connected') connectedCb = cb
      return { dispose: vi.fn() }
    })
    // Re-create store to trigger the socket.on wiring
    const store2 = new ServerStore(socket as unknown as import('../../src/http/HttpClient.js').HttpClient, socket, new Cache('t', null))
    const spy = vi.fn()
    store2.on('server:connected', spy)
    connectedCb({})
    expect(spy).toHaveBeenCalled()
  })
})
