import { TypedStore } from './TypedStore.js'
import type { UserStoreEvents } from '../types/events.js'
import type { UserInfo, CpuStats, ConsoleMessage } from '../types/game.js'
import type { HttpClient } from '../http/HttpClient.js'
import type { SocketClient } from '../socket/SocketClient.js'
import type { Cache } from '../cache/Cache.js'
import type { Subscription } from '../subscription/index.js'

export class UserStore extends TypedStore<UserStoreEvents> {
  private readonly http: HttpClient
  private readonly socket: SocketClient
  private readonly cache: Cache
  readonly console: ConsoleMessage[] = []
  readonly maxConsoleSize: number
  private _cpu: CpuStats | null = null
  get cpu(): CpuStats | null { return this._cpu }
  private userId: string | null = null

  constructor(http: HttpClient, socket: SocketClient, cache: Cache, maxConsoleSize = 100) {
    super()
    this.http = http
    this.socket = socket
    this.cache = cache
    this.maxConsoleSize = maxConsoleSize
  }

  async me(): Promise<UserInfo> {
    const cached = this.cache.get<UserInfo>('user/me')
    if (cached) return cached
    const res = await this.http.auth.me()
    const user = res as unknown as UserInfo
    this.userId = user._id
    this.cache.set('user/me', user, 60_000)
    return user
  }

  subscribe(channel: 'console' | 'cpu' | 'code'): Subscription {
    let socketSub: Subscription | null = null
    let listenerSub: Subscription | null = null
    let disposed = false

    const setup = async () => {
      try {
        const uid = this.userId ?? (await this.me())._id
        if (disposed) return
        const fullChannel = `user:${uid}/${channel}`
        socketSub = this.socket.subscribe(fullChannel)
        listenerSub = this.socket.on(fullChannel, (data) => {
          if (channel === 'cpu') {
            this._cpu = data as CpuStats
            this.emit('user:cpu', this._cpu)
          } else if (channel === 'console') {
            const msg = data as ConsoleMessage
            this.console.push(msg)
            if (this.console.length > this.maxConsoleSize) {
              this.console.splice(0, this.console.length - this.maxConsoleSize)
            }
            this.emit('user:console', { messages: msg })
          } else if (channel === 'code') {
            this.emit('user:code', data as { branch: string; modules: Record<string, string> })
          }
        })
      } catch (err) {
        if (!disposed) {
          this.dispatchEvent(new ErrorEvent('error', { error: err instanceof Error ? err : new Error(String(err)) }))
        }
      }
    }

    void setup()

    return {
      dispose: () => {
        disposed = true
        socketSub?.dispose()
        listenerSub?.dispose()
      },
    }
  }
}
