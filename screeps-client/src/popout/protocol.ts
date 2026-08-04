// BroadcastChannel protocol between the main window (the "host", which owns the
// ScreepsClient connection) and popout windows (thin renderers of the log /
// console / memory panes). Popouts never connect themselves: they address
// requests to a host, the host proxies them onto its client and pushes
// subscribed events back over the channel.
//
// A host identifies itself with a random `host` id in every heartbeat. A popout
// binds to the first host it hears, tags its requests with that id, and rebinds
// (re-issuing its subscriptions) when the heartbeat goes silent and a new host
// appears — so a main-window reload heals automatically.

import type { ServerVersion, UserInfo } from 'screeps-connectivity'

export const POPOUT_PARAM = 'popout'

/** True when this window was opened as a popout (?popout in the URL). */
export const isPopoutWindow = new URLSearchParams(window.location.search).has(POPOUT_PARAM)

export type PopoutMethod =
  | 'console.exec'
  | 'memory.get'
  | 'memory.set'
  | 'memory.segment.get'
  | 'subscribe'
  | 'unsubscribe'
  | 'session.state'
  | 'room.terrainBulk'
  | 'mapStats.request'
  | 'server.worldInfo'
  | 'user.worldStartRoom'
  | 'navigation.navigateTo'

export interface PopoutRequest {
  kind: 'request'
  /** Host id this request is addressed to; other hosts ignore it. */
  host: string
  popoutId: string
  id: number
  method: PopoutMethod
  args: unknown[]
}

export interface PopoutResponse {
  kind: 'response'
  popoutId: string
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

/** Pushed by the host for subscribed data; `topic` is the connectivity event name. */
export interface PopoutEventMessage {
  kind: 'event'
  host: string
  topic: string
  data: unknown
}

export interface PopoutHeartbeat {
  kind: 'heartbeat'
  host: string
}

export interface PopoutPing {
  kind: 'ping'
  popoutId: string
}

export interface PopoutBye {
  kind: 'bye'
  popoutId: string
}

/**
 * "A window is about to show the world map — every other map view yields."
 * Deliberately not host-filtered: it must reach a popout that is still bound to
 * a dead host id after a main-window reload.
 */
export interface PopoutMapClose {
  kind: 'mapclose'
}

export type PopoutMessage =
  | PopoutRequest
  | PopoutResponse
  | PopoutEventMessage
  | PopoutHeartbeat
  | PopoutPing
  | PopoutBye
  | PopoutMapClose

/**
 * Channel name for one server+user session. The sid is passed to the popout via
 * URL, so both sides derive the identical name — and it stays stable across a
 * main-window reload, which is what lets orphaned popouts reattach.
 */
export function popoutChannelName(sid: string): string {
  return `screeps:popout:${sid}`
}

/** Subscription topic for a memory watch path. */
export function memoryTopic(path: string, shard: string | null): string {
  return `memory:${shard ?? ''}:${path}`
}

/** Subscription topic for one room's map2 (dots/roads/walls) channel. */
export function map2Topic(room: string, shard: string | null): string {
  return `map2:${shard ?? ''}:${room}`
}

/** Subscription topic for a shard's map visuals. */
export function mapVisualTopic(shard: string | null): string {
  return `mapVisual:${shard ?? ''}`
}

/** Forwarding gate for mapStats:room events — no server subscription behind it. */
export const MAP_STATS_TOPIC = 'mapStats'

/** Forwarding gate for navigation:change events from the main window. */
export const NAVIGATION_TOPIC = 'navigation'

/** Snapshot of the main window's session, served to `session.state`. */
export interface PopoutSessionState {
  userInfo: UserInfo | null
  serverVersion: ServerVersion | null
  room: string | null
  shard: string | null
  /**
   * Server URL of the host's session. Per-server settings (the custom UI
   * segment) hang off it, and a popout opened by hand in a new tab starts with
   * an empty sessionStorage — so the host's value is what makes those keys
   * resolve to the same entries the main window uses.
   */
  url: string | null
}

export const HOST_HEARTBEAT_MS = 2000
/** Popout declares the host gone after this long without a heartbeat. */
export const HOST_TIMEOUT_MS = 6000
export const POPOUT_PING_MS = 2000
/** Host drops a popout's subscriptions after this long without a ping. */
export const POPOUT_TIMEOUT_MS = 8000
export const CALL_TIMEOUT_MS = 15000
