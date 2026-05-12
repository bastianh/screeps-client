import { HttpClient } from './http/HttpClient.js'
import { SocketClient } from './socket/SocketClient.js'
import { Cache } from './cache/Cache.js'
import { RoomStore } from './stores/RoomStore.js'
import { UserStore } from './stores/UserStore.js'
import { ServerStore } from './stores/ServerStore.js'
import type { AuthStrategy } from './http/auth/AuthStrategy.js'
import type { StorageAdapter } from './storage/StorageAdapter.js'

type WsConstructor = typeof globalThis.WebSocket

export interface ScreepsClientOptions {
  url: string
  auth: AuthStrategy
  storage?: StorageAdapter | null
  WebSocket?: WsConstructor
}

export class ScreepsClient {
  readonly http: HttpClient
  readonly socket: SocketClient
  readonly stores: {
    readonly room: RoomStore
    readonly user: UserStore
    readonly server: ServerStore
  }
  private readonly cache: Cache

  constructor(opts: ScreepsClientOptions) {
    let namespace: string
    try {
      namespace = new URL(opts.url).hostname
    } catch {
      throw new TypeError(`ScreepsClient: invalid url "${opts.url}"`)
    }
    this.cache = new Cache(namespace, opts.storage ?? null)
    this.http = new HttpClient({ url: opts.url, auth: opts.auth })
    this.socket = new SocketClient({ url: opts.url, WebSocket: opts.WebSocket })
    this.stores = {
      room: new RoomStore(this.http, this.socket, this.cache),
      user: new UserStore(this.http, this.socket, this.cache),
      server: new ServerStore(this.http, this.socket, this.cache),
    }
  }

  get isConnected(): boolean {
    return this.socket.isConnected
  }

  async connect(): Promise<void> {
    await this.http.authenticate()
    await this.socket.connect(this.http.token!)
  }

  disconnect(): void {
    this.socket.disconnect()
  }
}
