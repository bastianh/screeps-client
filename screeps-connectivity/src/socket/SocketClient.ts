import { parseMessage } from './MessageParser.js'
import type { Subscription } from '../subscription/index.js'

type WsConstructor = typeof globalThis.WebSocket

export class SocketClient {
  private readonly wsUrl: string
  private readonly WS: WsConstructor
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

  constructor(opts: { url: string; WebSocket?: WsConstructor }) {
    const base = opts.url.replace(/^http/, 'ws').replace(/\/$/, '')
    this.wsUrl = `${base}/socket/websocket`
    this.WS = opts.WebSocket ?? globalThis.WebSocket
  }

  get isConnected(): boolean {
    return this._connected
  }

  connect(token: string): Promise<void> {
    this._intentionalClose = false
    this.token = token
    this.authSub?.dispose()
    this.authSub = null
    return new Promise((resolve, reject) => {
      this.ws = new this.WS(this.wsUrl) as WebSocket
      this.ws.onopen = () => {
        this._connected = true
        this.reconnecting = false
        this.rawSend(`auth ${this.token}`)
        this.authSub = this.once('auth', (data) => {
          const cmd = data as { status: string; token?: string }
          if (cmd.status === 'ok') {
            this.authed = true
            if (cmd.token) this.token = cmd.token
            while (this.queue.length) this.rawSend(this.queue.shift()!)
            this.emit('connected', {})
            resolve()
          } else {
            reject(new Error('WebSocket auth failed'))
          }
        })
      }
      this.ws.onclose = () => {
        this._connected = false
        this.authed = false
        this.authSub?.dispose()
        this.authSub = null
        this.emit('disconnected', { willReconnect: this.reconnecting })
        void this.scheduleReconnect()
      }
      this.ws.onerror = (err) => {
        if (!this._connected) reject(err)
      }
      this.ws.onmessage = (event) => { this.handleMessage(event).catch(err => { console.error('SocketClient: message parse error', err) }) }
    })
  }

  disconnect(): void {
    this._intentionalClose = true
    this.reconnecting = false
    this.ws?.close()
    this.ws = null
    this._connected = false
    this.authed = false
    this.queue.length = 0
  }

  subscribe(channel: string): Subscription {
    const count = this.subs.get(channel) ?? 0
    this.subs.set(channel, count + 1)
    if (count === 0) {
      this.sendOrQueue(`subscribe ${channel}`)
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
    } else {
      this.subs.set(channel, count - 1)
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
    this.listeners.get(channel)?.forEach(cb => cb(data))
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
    while (retries < this.MAX_RETRIES && this.reconnecting) {
      const delay = Math.min(Math.pow(2, retries) * 100, this.MAX_DELAY_MS)
      await new Promise(r => setTimeout(r, delay))
      if (!this.reconnecting) return
      try {
        await this.connect(this.token!)
        for (const channel of this.subs.keys()) {
          this.rawSend(`subscribe ${channel}`)
        }
        return
      } catch {
        retries++
      }
    }
    this.reconnecting = false
    if (retries >= this.MAX_RETRIES) {
      this.emit('socket:error', new Error(`WebSocket reconnection failed after ${this.MAX_RETRIES} retries`))
    }
  }
}
