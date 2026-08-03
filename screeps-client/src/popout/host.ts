import type { ScreepsClient, Subscription } from 'screeps-connectivity'
import { userInfo } from '~/stores/clientStore.js'
import { createLogger } from '~/utils/log.js'
import { SS, getSession } from '~/utils/storage.js'
import { HOST_HEARTBEAT_MS, POPOUT_PARAM, POPOUT_TIMEOUT_MS, memoryTopic, popoutChannelName } from './protocol.js'
import type { PopoutMessage, PopoutRequest } from './protocol.js'

const { log } = createLogger('popout-host')

interface TopicEntry {
  sub: Subscription
  owners: Set<string>
}

/**
 * Session id shared between the main window and its popouts. Stable across a
 * main-window reload (URL + user id), so popouts can reattach. Null while the
 * user is unknown (guest / not yet loaded) — no popouts then.
 */
export function popoutSid(): string | null {
  const url = getSession(SS.url)
  const uid = userInfo()?._id
  if (!url || !uid) return null
  return `${url}#${uid}`
}

/** Open a popout window rendering the given panes. */
export function openPopoutWindow(opts: { sid: string; panes: string[]; shard: string | null }): void {
  const params = new URLSearchParams()
  params.set(POPOUT_PARAM, '1')
  params.set('sid', opts.sid)
  params.set('panes', opts.panes.join(','))
  if (opts.shard) params.set('shard', opts.shard)
  window.open(`${window.location.pathname}?${params.toString()}`, '_blank', 'popup,width=1100,height=480')
}

/**
 * Start serving popout windows over the session's BroadcastChannel. The host
 * proxies requests onto `client`, ref-counts subscription topics across popouts
 * (dropping them when a popout says goodbye or stops pinging), and forwards
 * subscribed console/memory events. Returns a dispose function.
 */
export function initPopoutHost(client: ScreepsClient, sid: string): () => void {
  const hostId = Math.random().toString(36).slice(2, 10)
  const channel = new BroadcastChannel(popoutChannelName(sid))
  const topics = new Map<string, TopicEntry>()
  const lastSeen = new Map<string, number>()
  log(`serving popouts as host ${hostId}`)

  const post = (msg: PopoutMessage) => channel.postMessage(msg)

  const openTopic = (topic: string): Subscription => {
    if (topic === 'console') {
      return client.stores.user.subscribe('console')
    }
    const match = /^memory:(?<shard>[^:]*):(?<path>.+)$/.exec(topic)
    if (match?.groups) {
      const { shard, path } = match.groups
      return client.stores.user.subscribeMemory(path, shard === '' ? null : shard)
    }
    throw new Error(`Unknown popout topic: ${topic}`)
  }

  const subscribe = (topic: string, popoutId: string) => {
    const entry = topics.get(topic)
    if (entry) {
      entry.owners.add(popoutId)
      return
    }
    topics.set(topic, { sub: openTopic(topic), owners: new Set([popoutId]) })
    log('topic opened:', topic)
  }

  const unsubscribe = (topic: string, popoutId: string) => {
    const entry = topics.get(topic)
    if (!entry) return
    entry.owners.delete(popoutId)
    if (entry.owners.size === 0) {
      entry.sub.dispose()
      topics.delete(topic)
      log('topic closed:', topic)
    }
  }

  const dropPopout = (popoutId: string) => {
    lastSeen.delete(popoutId)
    for (const topic of [...topics.keys()]) {
      unsubscribe(topic, popoutId)
    }
  }

  // Forward subscribed events. Console is a single topic; memory events carry
  // their path+shard and are forwarded only while some popout watches that topic.
  const consoleSub = client.stores.user.on('user:console', (data) => {
    if (topics.has('console')) post({ kind: 'event', host: hostId, topic: 'user:console', data })
  })
  const memorySub = client.stores.user.on('user:memory', (data) => {
    if (topics.has(memoryTopic(data.path, data.shard))) {
      post({ kind: 'event', host: hostId, topic: 'user:memory', data })
    }
  })

  const handleRequest = (msg: PopoutRequest): Promise<unknown> | unknown => {
    const args = msg.args
    switch (msg.method) {
      case 'console.exec':
        return client.http.user.console(args[0] as string, args[1] as string)
      case 'memory.get':
        return client.http.user.memory.get(args[0] as string, args[1] as string | null | undefined)
      case 'memory.set':
        return client.http.user.memory.set(args[0] as string, args[1], args[2] as string | null | undefined)
      case 'subscribe':
        return subscribe(args[0] as string, msg.popoutId)
      case 'unsubscribe':
        return unsubscribe(args[0] as string, msg.popoutId)
    }
  }

  channel.onmessage = (event: MessageEvent<PopoutMessage>) => {
    const msg = event.data
    switch (msg.kind) {
      case 'ping':
        // Answer a new popout right away so it binds without waiting a beat
        if (!lastSeen.has(msg.popoutId)) post({ kind: 'heartbeat', host: hostId })
        lastSeen.set(msg.popoutId, Date.now())
        break
      case 'bye':
        dropPopout(msg.popoutId)
        break
      case 'request': {
        if (msg.host !== hostId) return
        lastSeen.set(msg.popoutId, Date.now())
        void (async () => {
          try {
            const result = await handleRequest(msg)
            post({ kind: 'response', popoutId: msg.popoutId, id: msg.id, ok: true, result })
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            post({ kind: 'response', popoutId: msg.popoutId, id: msg.id, ok: false, error })
          }
        })()
        break
      }
    }
  }

  const timer = setInterval(() => {
    post({ kind: 'heartbeat', host: hostId })
    const deadline = Date.now() - POPOUT_TIMEOUT_MS
    for (const [popoutId, seen] of lastSeen) {
      if (seen < deadline) {
        log('popout timed out:', popoutId)
        dropPopout(popoutId)
      }
    }
  }, HOST_HEARTBEAT_MS)
  post({ kind: 'heartbeat', host: hostId })

  return () => {
    clearInterval(timer)
    consoleSub.dispose()
    memorySub.dispose()
    for (const entry of topics.values()) entry.sub.dispose()
    topics.clear()
    channel.close()
  }
}
