import { TypedStore } from './TypedStore.js'
import type { Logger } from '../logger.js'
import type { UserStoreEvents } from '../types/events.js'
import type { UserInfo, CpuStats, ConsoleMessage, WorldStatus } from '../types/game.js'
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
  private _userInfo: UserInfo | null = null
  get userInfo(): UserInfo | null { return this._userInfo }
  private _userId: string | null = null
  get userId(): string | null { return this._userId }
  private _worldStatus: WorldStatus | null = null
  get worldStatusValue(): WorldStatus | null { return this._worldStatus }
  private _mePromise: Promise<UserInfo> | null = null

  constructor(http: HttpClient, socket: SocketClient, cache: Cache, logger?: Logger, maxConsoleSize = 100) {
    super(logger)
    this.http = http
    this.socket = socket
    this.cache = cache
    this.maxConsoleSize = maxConsoleSize
  }

  async me(): Promise<UserInfo> {
    const cached = this.cache.get<UserInfo>('user/me')
    if (cached) {
      this._userId = cached._id
      this._userInfo = cached
      return cached
    }
    if (this._mePromise) {
      return this._mePromise
    }
    this.logger.log('fetch me')
    this._mePromise = this.http.auth.me().then((res) => {
      const user = res as unknown as UserInfo
      this._userId = user._id
      this._userInfo = user
      this.cache.set('user/me', user, 60_000)
      this.emit('user:me', user)
      return user
    }).finally(() => {
      this._mePromise = null
    })
    return this._mePromise
  }

  async refreshMe(): Promise<UserInfo> {
    this.logger.log('refresh me')
    this.cache.delete('user/me')
    return this.me()
  }

  async worldStatus(): Promise<WorldStatus> {
    const cached = this.cache.get<WorldStatus>('user/worldStatus')
    if (cached) {
      this._worldStatus = cached
      return cached
    }

    this.logger.log('fetch world status')
    const res = await this.http.user.worldStatus()
    this._worldStatus = res.status
    this.cache.set('user/worldStatus', res.status, 60_000)
    this.emit('user:worldStatus', { status: res.status })
    return res.status
  }

  async refreshWorldStatus(): Promise<WorldStatus> {
    this.logger.log('refresh world status')
    this.cache.delete('user/worldStatus')
    return this.worldStatus()
  }

  subscribe(channel: 'console' | 'cpu' | 'code'): Subscription {
    this.logger.log('subscribe', channel)
    let socketSub: Subscription | null = null
    let listenerSub: Subscription | null = null
    let disposed = false

    const setup = async () => {
      try {
        const uid = this._userId ?? (await this.me())._id
        if (disposed) return
        const fullChannel = `user:${uid}/${channel}`
        socketSub = this.socket.subscribe(fullChannel)
        listenerSub = this.socket.on(fullChannel, (data) => {
          if (channel === 'cpu') {
            this._cpu = data as CpuStats
            this.emit('user:cpu', this._cpu)
          } else if (channel === 'console') {
            const raw = data as { messages?: ConsoleMessage, error?: string }
            const msg: ConsoleMessage = {
              log: raw.messages?.log ?? [],
              results: raw.messages?.results ?? [],
              error: raw.messages?.error ?? [],
            }
            if (raw.error) {
              msg.error.push(raw.error)
            }
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
        this.logger.log('unsubscribe', channel)
        disposed = true
        socketSub?.dispose()
        listenerSub?.dispose()
      },
    }
  }

  subscribeMemory(path: string, shard?: string | null): Subscription {
    this.logger.log('subscribe memory', path)
    let socketSub: Subscription | null = null
    let listenerSub: Subscription | null = null
    let disposed = false

    const setup = async () => {
      try {
        const uid = this._userId ?? (await this.me())._id
        if (disposed) return
        const shardSegment = shard ? `${shard}/` : ''
        const fullChannel = `user:${uid}/memory/${shardSegment}${path}`
        socketSub = this.socket.subscribe(fullChannel)
        listenerSub = this.socket.on(fullChannel, (raw) => {
          if (typeof raw === 'string' && raw.startsWith('gz:')) {
            void (async () => {
              try {
                const { decompressZlib } = await import('../http/decompress.js')
                const value = await decompressZlib(raw)
                this.emit('user:memory', { path, shard: shard ?? null, value })
              } catch (err) {
                this.logger.log('memory decompress failed', err)
              }
            })()
            return
          }
          // Memory values arrive as JSON-encoded strings inside the WS frame,
          // e.g. the frame ["user:x/memory/foo","1"] delivers raw="1" here.
          // Objects can't be serialized over WS; the server sends "[object Object]".
          // Emit a sentinel so the UI can show a collapsed placeholder and fetch
          // the real value via HTTP only when the user expands it.
          if (raw === '[object Object]') {
            this.logger.log('memory object placeholder', path)
            this.emit('user:memory', { path, shard: shard ?? null, value: { __screeps_object__: true } })
            return
          }
          let value: unknown = raw
          if (raw === 'undefined') {
            value = undefined
          } else if (typeof raw === 'string') {
            try { value = JSON.parse(raw) } catch { /* leave as-is */ }
          }
          this.logger.log('memory value received', path, value)
          this.emit('user:memory', { path, shard: shard ?? null, value })
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
        this.logger.log('unsubscribe memory', path)
        disposed = true
        socketSub?.dispose()
        listenerSub?.dispose()
      },
    }
  }

  /** Subscribe to the general user stream to receive global data like flags. */
  subscribeUserStream(): Subscription {
    this.logger.log('subscribe user stream')
    let socketSub: Subscription | null = null
    let listenerSub: Subscription | null = null
    let disposed = false

    const setup = async () => {
      try {
        const uid = this._userId ?? (await this.me())._id
        if (disposed) return
        const fullChannel = `user:${uid}`
        socketSub = this.socket.subscribe(fullChannel)
        listenerSub = this.socket.on(fullChannel, (data) => {
          const payload = data as Record<string, unknown>
          // Log flags received via user stream
          if (payload && typeof payload === 'object' && 'flags' in payload) {
            const flags = payload.flags as Record<string, unknown> | undefined
            if (flags && typeof flags === 'object') {
              for (const [name, flagData] of Object.entries(flags)) {
                const fd = flagData as Record<string, unknown> | null
                if (fd && typeof fd === 'object') {
                  const room = fd.room ?? 'unknown'
                  const x = fd.x ?? '?'
                  const y = fd.y ?? '?'
                  this.logger.log(`[flag:user] ${name} @ ${room} (${x},${y})`)
                }
              }
            }
          }
          this.emit('user:stream', payload)
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
        this.logger.log('unsubscribe user stream')
        disposed = true
        socketSub?.dispose()
        listenerSub?.dispose()
      },
    }
  }
}
