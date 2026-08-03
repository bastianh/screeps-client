import { createSignal } from 'solid-js'
import type { Subscription } from 'screeps-connectivity'
import { createLogger } from '~/utils/log.js'
import { CALL_TIMEOUT_MS, HOST_TIMEOUT_MS, POPOUT_PING_MS, popoutChannelName } from './protocol.js'
import type { PopoutMessage, PopoutMethod } from './protocol.js'

const { log } = createLogger('popout')

export interface PopoutRpc {
  /** Reactive: whether a host (main window) is currently answering. */
  hostAlive: () => boolean
  call: (method: PopoutMethod, args: unknown[]) => Promise<unknown>
  /** Ref-counted topic subscription, established on the bound host. */
  subscribe: (topic: string) => Subscription
  /** Listen for events forwarded by the host (topic = connectivity event name). */
  on: (topic: string, callback: (data: never) => void) => Subscription
  /** Announce this window is about to show the world map; other map views yield. */
  postMapClose: () => void
}

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Popout-side endpoint of the BroadcastChannel protocol. Binds to the first
 * host heard on the channel; while no host is bound, calls queue up. When the
 * bound host goes silent and a new one appears (main-window reload), all live
 * topic subscriptions are re-issued against it.
 */
export function createPopoutRpc(sid: string): PopoutRpc {
  const popoutId = Math.random().toString(36).slice(2, 10)
  const channel = new BroadcastChannel(popoutChannelName(sid))
  const [hostAlive, setHostAlive] = createSignal(false)
  const pending = new Map<number, PendingCall>()
  const topicRefs = new Map<string, number>()
  const listeners = new Map<string, Set<(data: never) => void>>()
  // Requests made while no host is bound; flushed on bind
  const queue: { id: number; method: PopoutMethod; args: unknown[] }[] = []
  let boundHost: string | null = null
  let lastHostSeen = 0
  let nextId = 0

  const postRequest = (host: string, req: { id: number; method: PopoutMethod; args: unknown[] }) => {
    channel.postMessage({ kind: 'request', host, popoutId, ...req } satisfies PopoutMessage)
  }

  const call = (method: PopoutMethod, args: unknown[]): Promise<unknown> => {
    const id = nextId++
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Main window did not respond'))
      }, CALL_TIMEOUT_MS)
      pending.set(id, { resolve, reject, timer })
      if (boundHost !== null) postRequest(boundHost, { id, method, args })
      else queue.push({ id, method, args })
    })
  }

  const bindHost = (host: string) => {
    boundHost = host
    lastHostSeen = Date.now()
    setHostAlive(true)
    log('bound to host', host)
    // (Re)establish all live topics on this host, then flush queued calls
    for (const topic of topicRefs.keys()) {
      void call('subscribe', [topic]).catch((err) => log('resubscribe failed:', topic, err))
    }
    for (const req of queue.splice(0)) postRequest(host, req)
  }

  channel.onmessage = (event: MessageEvent<PopoutMessage>) => {
    const msg = event.data
    switch (msg.kind) {
      case 'heartbeat':
        if (boundHost === null) bindHost(msg.host)
        if (msg.host === boundHost) lastHostSeen = Date.now()
        break
      case 'event': {
        if (msg.host !== boundHost) return
        const callbacks = listeners.get(msg.topic)
        if (callbacks) {
          for (const callback of callbacks) callback(msg.data as never)
        }
        break
      }
      case 'response': {
        if (msg.popoutId !== popoutId) return
        const entry = pending.get(msg.id)
        if (!entry) return
        pending.delete(msg.id)
        clearTimeout(entry.timer)
        if (msg.ok) entry.resolve(msg.result)
        else entry.reject(new Error(msg.error ?? 'Unknown popout error'))
        break
      }
      case 'mapclose': {
        // Deliberately not host-filtered — a takeover must reach this popout even
        // while it is bound to a host id that died in a main-window reload.
        const callbacks = listeners.get('mapclose')
        if (callbacks) {
          for (const callback of callbacks) callback(undefined as never)
        }
        break
      }
    }
  }

  setInterval(() => {
    channel.postMessage({ kind: 'ping', popoutId } satisfies PopoutMessage)
    if (boundHost !== null && Date.now() - lastHostSeen > HOST_TIMEOUT_MS) {
      log('host lost')
      boundHost = null
      setHostAlive(false)
    }
  }, POPOUT_PING_MS)
  channel.postMessage({ kind: 'ping', popoutId } satisfies PopoutMessage)

  window.addEventListener('pagehide', () => {
    channel.postMessage({ kind: 'bye', popoutId } satisfies PopoutMessage)
  })

  const subscribe = (topic: string): Subscription => {
    const count = topicRefs.get(topic) ?? 0
    topicRefs.set(topic, count + 1)
    if (count === 0 && boundHost !== null) {
      void call('subscribe', [topic]).catch((err) => log('subscribe failed:', topic, err))
    }
    let disposed = false
    return {
      dispose: () => {
        if (disposed) return
        disposed = true
        const remaining = (topicRefs.get(topic) ?? 1) - 1
        if (remaining <= 0) {
          topicRefs.delete(topic)
          if (boundHost !== null) {
            void call('unsubscribe', [topic]).catch((err) => log('unsubscribe failed:', topic, err))
          }
        } else {
          topicRefs.set(topic, remaining)
        }
      },
    }
  }

  const on = (topic: string, callback: (data: never) => void): Subscription => {
    let callbacks = listeners.get(topic)
    if (!callbacks) {
      callbacks = new Set()
      listeners.set(topic, callbacks)
    }
    callbacks.add(callback)
    return {
      dispose: () => {
        callbacks.delete(callback)
        if (callbacks.size === 0) listeners.delete(topic)
      },
    }
  }

  const postMapClose = () => {
    channel.postMessage({ kind: 'mapclose' } satisfies PopoutMessage)
  }

  return { hostAlive, call, subscribe, on, postMapClose }
}
