import { parseMessage } from './MessageParser.js'
import { Logger } from '../logger.js'
import type { Subscription } from '../subscription/index.js'

type WsConstructor = typeof globalThis.WebSocket

export class SocketClient {
  private readonly wsUrl: string
  private readonly WS: WsConstructor
  private readonly logger: Logger
  private readonly gzip: boolean
  private ws: WebSocket | null = null
  private token: string | null = null
  private authed = false
  private _connected = false
  private reconnecting = false
  private authSub: Subscription | null = null
  private readonly queue: string[] = []
  private readonly subs = new Map<string, number>()
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>()

  private readonly MAX_RETRIES = 10
  private readonly MAX_DELAY_MS = 60_000
  private _intentionalClose = false

  constructor(opts: { url: string; WebSocket?: WsConstructor; logger?: Logger; gzip?: boolean }) {
    const base = opts.url.replace(/^http/, 'ws').replace(/\/$/, '')
    this.wsUrl = `${base}/socket/websocket`
    this.WS = opts.WebSocket ?? globalThis.WebSocket
    this.logger = opts.logger ?? Logger.create()
    // Off by default — matches the official client, which never sends `gzip on`.
    // The decode path is always available; opt in explicitly to enable it.
    this.gzip = opts.gzip ?? false
  }

  get isConnected(): boolean {
    return this._connected
  }

  /** Update the stored token. Used to keep WS and HTTP token in sync after an HTTP rotation. */
  setToken(token: string): void {
    this.token = token
  }

  connect(token: string): Promise<void> {
    this.logger.log('connect', this.wsUrl)
    // Note: do NOT reset _intentionalClose here. If disconnect() ran while a
    // reconnect attempt was awaiting this connect(), resetting the flag would
    // silently re-open the socket the user already asked to close. The flag
    // is only cleared on an explicit external connect (see below).
    if (!this.reconnecting) this._intentionalClose = false
    this.token = token
    this.authSub?.dispose()
    this.authSub = null
    return new Promise((resolve, reject) => {
      this.ws = new this.WS(this.wsUrl) as WebSocket
      this.ws.onopen = () => {
        this.logger.log('WebSocket opened')
        this._connected = true
        this.reconnecting = false
        this.rawSend(`auth ${this.token}`)
        this.authSub = this.once('auth', (data) => {
          const cmd = data as { status: string; token?: string }
          if (cmd.status === 'ok') {
            this.logger.log('auth ok')
            this.authed = true
            if (cmd.token) {
              this.token = cmd.token
              this.emit('socket:tokenRefresh', { token: cmd.token })
            }
            // Ask the server to deflate outbound event frames before any
            // subscribe is flushed, so the first updates already arrive as gz:.
            // The server only sends the compressed form when it's actually
            // smaller, so this never enlarges small control frames.
            if (this.gzip) this.rawSend('gzip on')
            while (this.queue.length) this.rawSend(this.queue.shift()!)
            this.emit('connected', {})
            resolve()
          } else {
            this.logger.log('auth failed')
            reject(new Error('WebSocket auth failed'))
          }
        })
      }
      this.ws.onclose = () => {
        this.logger.log('WebSocket closed')
        this._connected = false
        this.authed = false
        this.authSub?.dispose()
        this.authSub = null
        this.emit('disconnected', { willReconnect: this.reconnecting, intentional: this._intentionalClose })
        void this.scheduleReconnect()
      }
      this.ws.onerror = (err) => {
        if (!this._connected) reject(err)
      }
      this.ws.onmessage = (event) => {
        this.handleMessage(event).catch(err => {
          const raw = typeof event.data === 'string' ? event.data.slice(0, 200) : '(binary)'
          this.logger.log('message parse error', err instanceof Error ? err.stack ?? err.message : String(err), 'raw:', raw)
          this.emit('socket:error', err instanceof Error ? err : new Error(String(err)))
        })
      }
    })
  }

  disconnect(): void {
    this.logger.log('disconnect')
    this._intentionalClose = true
    this.reconnecting = false
    this.ws?.close()
    this.ws = null
    this._connected = false
    this.authed = false
    this.queue.length = 0
  }

  private activeSubs(): string {
    return Array.from(this.subs.entries())
      .map(([ch, count]) => `${ch}(${count})`)
      .join(', ') || '(none)'
  }

  subscribe(channel: string): Subscription {
    const count = this.subs.get(channel) ?? 0
    this.subs.set(channel, count + 1)
    if (count === 0) {
      this.logger.log('subscribe', channel, 'active:', this.activeSubs())
      this.sendOrQueue(`subscribe ${channel}`)
    } else {
      this.logger.log('subscribe', channel, `(refs: ${count + 1})`, 'active:', this.activeSubs())
    }
    return { dispose: () => this.doUnsubscribe(channel) }
  }

  on(channel: string, cb: (data: unknown) => void): Subscription {
    let set = this.listeners.get(channel)
    if (!set) { set = new Set(); this.listeners.set(channel, set) }
    set.add(cb)
    return { dispose: () => { this.listeners.get(channel)?.delete(cb) } }
  }

  private once(channel: string, cb: (data: unknown) => void): Subscription {
    const sub = this.on(channel, (data) => { sub.dispose(); cb(data) })
    return sub
  }

  private doUnsubscribe(channel: string): void {
    const count = this.subs.get(channel) ?? 0
    if (count <= 1) {
      this.subs.delete(channel)
      if (this.authed) this.rawSend(`unsubscribe ${channel}`)
      this.logger.log('unsubscribe', channel, 'active:', this.activeSubs())
    } else {
      this.subs.set(channel, count - 1)
      this.logger.log('unsubscribe', channel, `(refs: ${count - 1})`, 'active:', this.activeSubs())
    }
  }

  private rawSend(data: string): void {
    this.ws?.send(data)
  }

  private sendOrQueue(data: string): void {
    if (this.authed) this.rawSend(data)
    else this.queue.push(data)
  }

  private emit(channel: string, data: unknown): void {
    this.listeners.get(channel)?.forEach(cb => {
      try {
        cb(data)
      } catch (err) {
        // A listener error on one channel must not prevent other listeners from
        // running, and must not be rethrown into handleMessage's .catch() where
        // it would be treated as a fatal socket error and kick the user out.
        this.logger.log('listener error on channel', channel, err instanceof Error ? err.stack ?? err.message : String(err))
      }
    })
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const parsed = await parseMessage(event)
    if (parsed.kind === 'server') {
      this.emit(parsed.command.type, parsed.command)
    } else {
      this.emit(parsed.message.channel, parsed.message.data)
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting || this._intentionalClose) return
    if (!this.token) { this.reconnecting = false; return }
    this.reconnecting = true
    let retries = 0
    while (retries < this.MAX_RETRIES && this.reconnecting && !this._intentionalClose) {
      const delay = Math.min(Math.pow(2, retries) * 100, this.MAX_DELAY_MS)
      this.logger.log(`reconnect attempt ${retries + 1}/${this.MAX_RETRIES} in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      if (!this.reconnecting || this._intentionalClose) return
      try {
        await this.connect(this.token!)
        // disconnect() may have run while connect() was in flight — honor it
        if (this._intentionalClose) {
          this.ws?.close()
          this.ws = null
          return
        }
        for (const channel of this.subs.keys()) {
          this.rawSend(`subscribe ${channel}`)
        }
        return
      } catch {
        retries++
      }
    }
    this.reconnecting = false
    if (retries >= this.MAX_RETRIES && !this._intentionalClose) {
      this.emit('socket:error', new Error(`WebSocket reconnection failed after ${this.MAX_RETRIES} retries`))
    }
  }
}
