import { createSignal } from 'solid-js'
import type { ScreepsClient, Subscription } from 'screeps-connectivity'
import { serverVersion, userInfo } from '~/stores/clientStore.js'
import { createLogger } from '~/utils/log.js'
import { SS, getSession } from '~/utils/storage.js'
import { HOST_HEARTBEAT_MS, MAP_STATS_TOPIC, NAVIGATION_TOPIC, POPOUT_PARAM, POPOUT_TIMEOUT_MS, map2Topic, mapVisualTopic, memoryTopic, popoutChannelName } from './protocol.js'
import type { PopoutMessage, PopoutRequest, PopoutSessionState } from './protocol.js'

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
export function openPopoutWindow(opts: {
  sid: string
  panes: string[]
  shard: string | null
  room?: string
  /** Pre-encoded query fragments appended verbatim (e.g. from mapViewQuery). */
  extraQuery?: string[]
  features?: string
}): void {
  const params = new URLSearchParams()
  params.set(POPOUT_PARAM, '1')
  params.set('sid', opts.sid)
  params.set('panes', opts.panes.join(','))
  if (opts.shard) params.set('shard', opts.shard)
  if (opts.room) params.set('room', opts.room)
  const query = [params.toString(), ...opts.extraQuery ?? []].join('&')
  window.open(`${window.location.pathname}?${query}`, '_blank', opts.features ?? 'popup,width=1100,height=480')
}

// The mapclose handshake ("whoever is about to show the world map broadcasts,
// whoever currently shows one yields") needs a channel handle outside of
// initPopoutHost's lifetime, and the Dashboard needs to react to incoming
// broadcasts — hence module-level signals rather than per-host state.
const [hostReady, setHostReady] = createSignal(false)
const [mapCloseRequests, setMapCloseRequests] = createSignal(0)
let activePost: ((msg: PopoutMessage) => void) | null = null

/** Reactive: whether a popout host is currently serving this window's session. */
export const popoutHostReady = hostReady

/** Reactive counter, bumped whenever a popout announces it is taking over the map. */
export { mapCloseRequests }

/** Tell every live map popout to yield — the main window is about to show the map. */
export function broadcastMapClose(): void {
  activePost?.({ kind: 'mapclose' })
}

export interface PopoutHostOptions {
  /** Snapshot of the main window's current view, served to `session.state`. */
  session?: () => { room: string | null; shard: string | null }
}

/**
 * Start serving popout windows over the session's BroadcastChannel. The host
 * proxies requests onto `client`, ref-counts subscription topics across popouts
 * (dropping them when a popout says goodbye or stops pinging), and forwards
 * subscribed console/memory events. Returns a dispose function.
 */
export function initPopoutHost(client: ScreepsClient, sid: string, opts?: PopoutHostOptions): () => void {
  const hostId = Math.random().toString(36).slice(2, 10)
  const channel = new BroadcastChannel(popoutChannelName(sid))
  const topics = new Map<string, TopicEntry>()
  const lastSeen = new Map<string, number>()
  log(`serving popouts as host ${hostId}`)

  const post = (msg: PopoutMessage) => channel.postMessage(msg)
  activePost = post
  setHostReady(true)

  const noopSub: Subscription = { dispose: () => {} }

  const openTopic = (topic: string): Subscription => {
    if (topic === 'console') {
      return client.stores.user.subscribe('console')
    }
    // Pure forwarding gates — the backing stores need no per-topic subscription.
    if (topic === NAVIGATION_TOPIC || topic === MAP_STATS_TOPIC) {
      return noopSub
    }
    const memory = /^memory:(?<shard>[^:]*):(?<path>.+)$/.exec(topic)
    if (memory?.groups) {
      const { shard, path } = memory.groups
      return client.stores.user.subscribeMemory(path, shard === '' ? null : shard)
    }
    const mapVisual = /^mapVisual:(?<shard>.*)$/.exec(topic)
    if (mapVisual?.groups) {
      const { shard } = mapVisual.groups
      return client.stores.user.subscribeMapVisual(shard === '' ? null : shard)
    }
    const map2 = /^map2:(?<shard>[^:]*):(?<room>.+)$/.exec(topic)
    if (map2?.groups) {
      const { shard, room } = map2.groups
      return client.stores.map.subscribeMap2(room, shard === '' ? null : shard)
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
  const navigationSub = client.stores.navigation.on('navigation:change', (data) => {
    if (topics.has(NAVIGATION_TOPIC)) post({ kind: 'event', host: hostId, topic: 'navigation:change', data })
  })
  // Unfiltered by shard on purpose: the map view's own mapStats listener doesn't
  // filter either, so a popout map behaves exactly like the inline one.
  const mapStatsSub = client.stores.mapStats.on('mapStats:room', (data) => {
    if (topics.has(MAP_STATS_TOPIC)) post({ kind: 'event', host: hostId, topic: 'mapStats:room', data })
  })
  const map2Sub = client.stores.map.on('room:map2update', (data) => {
    if (topics.has(map2Topic(data.room, data.shard))) {
      post({ kind: 'event', host: hostId, topic: 'room:map2update', data })
    }
  })
  const mapVisualSub = client.stores.user.on('user:mapVisual', (data) => {
    if (topics.has(mapVisualTopic(data.shard))) {
      post({ kind: 'event', host: hostId, topic: 'user:mapVisual', data })
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
      case 'memory.segment.get':
        return client.http.user.memory.segment.get(args[0] as number, args[1] as string | null | undefined)
      case 'subscribe':
        return subscribe(args[0] as string, msg.popoutId)
      case 'unsubscribe':
        return unsubscribe(args[0] as string, msg.popoutId)
      case 'session.state':
        return {
          userInfo: userInfo(),
          serverVersion: serverVersion(),
          room: opts?.session?.().room ?? null,
          shard: opts?.session?.().shard ?? null,
          url: getSession(SS.url),
        } satisfies PopoutSessionState
      case 'room.terrainBulk':
        return client.stores.room.terrainBulk(args[0] as string[], args[1] as string | null)
      case 'mapStats.request':
        return client.stores.mapStats.request(args[0] as string[], args[1] as string, args[2] as string | undefined)
      case 'server.worldInfo':
        return client.stores.server.worldInfo(args[0] as string | undefined)
      case 'user.worldStartRoom':
        return client.http.user.worldStartRoom(args[0] as string | null | undefined)
      case 'navigation.navigateTo':
        return client.stores.navigation.navigateTo(args[0] as string, args[1] as string | null)
    }
  }

  channel.onmessage = (event: MessageEvent<PopoutMessage>) => {
    const msg = event.data
    switch (msg.kind) {
      case 'ping':
        // Answer every ping right away: a new popout binds without waiting a
        // beat, and — more importantly — heartbeats stay flowing while this
        // window is a hidden tab, where the browser throttles the interval
        // below but still delivers channel messages immediately.
        post({ kind: 'heartbeat', host: hostId })
        lastSeen.set(msg.popoutId, Date.now())
        break
      case 'bye':
        dropPopout(msg.popoutId)
        break
      case 'mapclose':
        setMapCloseRequests((n) => n + 1)
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
    if (activePost === post) {
      activePost = null
      setHostReady(false)
    }
    consoleSub.dispose()
    memorySub.dispose()
    navigationSub.dispose()
    mapStatsSub.dispose()
    map2Sub.dispose()
    mapVisualSub.dispose()
    for (const entry of topics.values()) entry.sub.dispose()
    topics.clear()
    channel.close()
  }
}
