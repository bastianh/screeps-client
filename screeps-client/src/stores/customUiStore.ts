// Player-defined UI elements ("Custom UI"), configured in a memory segment.
//
// The segment holds a compact JSON document describing buttons for the map and
// room sidebars. Clicking a button calls a single handler function in the
// player's bot code via the console API, passing a JSON payload with a short
// correlation id and the current view context. The bot answers by logging a
// line starting with the SCUI marker; the client matches it by id and shows a
// toast and/or navigates. The client never evaluates code from the segment —
// the handler name is validated against an identifier pattern and all context
// values travel inside one JSON.stringify'd argument, so game data (creep
// names etc.) can never break out into the expression.
import { createSignal } from 'solid-js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'
import { client, isGuest, userInfo } from './clientStore.js'
import { addToast } from './toastStore.js'
import { insertConsole } from './consoleStore.js'
import { roomOwner, controllerReservation } from './roomDataStore.js'
import { LS, SS, getSession, getStr, setStr, removeLocal } from '~/utils/storage.js'
import { createLogger } from '~/utils/log.js'

const { log, warn } = createLogger('customUi')

export type CustomUiNeed = 'room' | 'selection' | 'tile'

export type CustomUiElementType = 'button' | 'select' | 'status' | 'header'

/** The viewer's relation to a room: owned/reserved by them, unclaimed, or someone else's. */
export type CustomUiRoomStanding = 'own' | 'reserved' | 'empty' | 'foreign'

export const ROOM_STANDINGS: readonly CustomUiRoomStanding[] = ['own', 'reserved', 'empty', 'foreign']

export interface CustomUiShowIf {
  /** Visible only while at least one selected object has this type (room view). */
  selType?: string
  /** Visible only while the room's standing is one of these. */
  room?: CustomUiRoomStanding[]
}

export interface CustomUiElement {
  type: CustomUiElementType
  label: string
  /** Command name (button, select). */
  cmd?: string
  /** Choices for a select element; the picked one is sent as payload `value`. */
  options?: string[]
  /** Memory path whose live value a status element displays. */
  path?: string
  /** Child elements of a header; hidden along with it, shown indented. */
  items?: CustomUiElement[]
  /** Object types an `objects` entry attaches to (e.g. ["creep", "powerBank"]). */
  obj?: string[]
  /** Restrict an `objects` entry to objects owned by the viewer / by someone else. */
  owner?: 'own' | 'foreign'
  needs?: CustomUiNeed[]
  confirm?: boolean
  showIf?: CustomUiShowIf
}

export interface CustomUiConfig {
  handler: string
  map: CustomUiElement[]
  room: CustomUiElement[]
  /** Elements rendered inside each matching selected object's card. */
  objects: CustomUiElement[]
}

export interface CustomUiTarget {
  id: string
  type: string
  name?: string
  x?: number
  y?: number
}

export interface CustomUiContext {
  view: 'map' | 'room'
  shard: string | null
  room?: string
  selection?: { id: string; type: string; name?: string }[]
  tile?: { x: number; y: number }
  /** The specific object an `objects` element was triggered on. */
  target?: CustomUiTarget
}

const MARKER = 'SCUI'
const RESPONSE_TIMEOUT_MS = 15_000
const MAX_ELEMENTS = 32
const MAX_LABEL = 40
const MAX_CMD = 64
const MAX_OPTIONS = 50
const MAX_PATH = 128
const NEEDS: readonly CustomUiNeed[] = ['room', 'selection', 'tile']
const TYPES: readonly CustomUiElementType[] = ['button', 'select', 'status', 'header']
// Dot-separated identifier path (e.g. "uiCommand" or "global.ui.run")
const HANDLER_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/

const [uiSegment, setUiSegmentSignal] = createSignal<number | null>(null)
const [uiShard, setUiShardSignal] = createSignal('')
const [uiConfig, setUiConfig] = createSignal<CustomUiConfig | null>(null)
const [uiError, setUiError] = createSignal<string | null>(null)
const [uiLoading, setUiLoading] = createSignal(false)

export { uiSegment, uiShard, uiConfig, uiError, uiLoading }

/** The viewer's relation to the room currently open in room view. */
export function roomViewStanding(): CustomUiRoomStanding {
  const me = userInfo()
  const owner = roomOwner()
  if (owner) return owner.userId === me?._id ? 'own' : 'foreign'
  const reservation = controllerReservation()
  if (reservation) return reservation.user === me?._id ? 'reserved' : 'foreign'
  return 'empty'
}

/** Whether an `objects` element attaches to this object, per its obj/owner filters. */
export function matchesObject(element: CustomUiElement, objType: string, objUser: string | null): boolean {
  if (!element.obj?.includes(objType)) return false
  if (element.owner !== undefined) {
    // Ownership filter only ever matches objects that carry a user field
    if (objUser === null) return false
    const mine = objUser === userInfo()?._id
    if (element.owner === 'own' ? !mine : mine) return false
  }
  const room = element.showIf?.room
  if (room !== undefined && !room.includes(roomViewStanding())) return false
  return true
}

// Segment numbers differ per server, so the persisted settings are keyed by
// the server URL of the active session.
function segmentKey(): string {
  return `${LS.customUiSegment}:${getSession(SS.url) ?? ''}`
}

function shardKey(): string {
  return `${LS.customUiShard}:${getSession(SS.url) ?? ''}`
}

function readPersistedSegment(): number | null {
  const raw = getStr(segmentKey())
  if (raw === null) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null
}

export function setUiSegment(segment: number | null): void {
  if (segment === null) removeLocal(segmentKey())
  else setStr(segmentKey(), String(segment))
  setUiSegmentSignal(segment)
  void loadCustomUi()
}

export function setUiShard(shard: string): void {
  const trimmed = shard.trim()
  if (trimmed) setStr(shardKey(), trimmed)
  else removeLocal(shardKey())
  setUiShardSignal(trimmed)
  void loadCustomUi()
}

function parseElements(raw: unknown, where: string, opts: { allowItems?: boolean; objectMode?: boolean } = {}): CustomUiElement[] {
  const allowItems = opts.allowItems ?? true
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new Error(`"${where}" must be an array`)
  if (raw.length > MAX_ELEMENTS) throw new Error(`"${where}" has more than ${MAX_ELEMENTS} elements`)
  return raw.map((el, i) => {
    const at = `${where}[${i}]`
    if (typeof el !== 'object' || el === null || Array.isArray(el)) throw new Error(`${at} must be an object`)
    const e = el as Record<string, unknown>
    const type = e.type === undefined ? 'button' : e.type
    if (!TYPES.includes(type as CustomUiElementType)) throw new Error(`${at}.type may only be ${TYPES.join(', ')}`)
    if (opts.objectMode && type !== 'button' && type !== 'select') {
      throw new Error(`${at}: only buttons and selects are allowed in "objects"`)
    }
    if (type === 'header' && !allowItems) throw new Error(`${at}: headers cannot be nested inside items`)
    if (typeof e.label !== 'string' || !e.label.trim()) throw new Error(`${at}.label is missing`)

    const element: CustomUiElement = {
      type: type as CustomUiElementType,
      label: e.label.trim().slice(0, MAX_LABEL),
      confirm: e.confirm === true,
    }

    if (element.type === 'button' || element.type === 'select') {
      if (typeof e.cmd !== 'string' || !e.cmd.trim()) throw new Error(`${at}.cmd is missing`)
      element.cmd = e.cmd.trim().slice(0, MAX_CMD)
    }

    if (element.type === 'select') {
      if (!Array.isArray(e.options) || e.options.length === 0 || e.options.some((o) => typeof o !== 'string' || !o.trim())) {
        throw new Error(`${at}.options must be a non-empty array of strings`)
      }
      if (e.options.length > MAX_OPTIONS) throw new Error(`${at}.options has more than ${MAX_OPTIONS} entries`)
      element.options = (e.options as string[]).map((o) => o.trim().slice(0, MAX_LABEL))
    }

    if (element.type === 'status') {
      if (typeof e.path !== 'string' || !e.path.trim() || e.path.trim().length > MAX_PATH || /\s/.test(e.path.trim())) {
        throw new Error(`${at}.path must be a memory path like "stats.energy"`)
      }
      element.path = e.path.trim()
    }

    if (e.items !== undefined) {
      if (element.type !== 'header') throw new Error(`${at}.items is only allowed on headers`)
      element.items = parseElements(e.items, `${at}.items`, { allowItems: false })
    }

    if (opts.objectMode) {
      const objList = Array.isArray(e.obj) ? e.obj : [e.obj]
      if (e.obj === undefined || objList.length === 0 || objList.some((o) => typeof o !== 'string' || !o.trim())) {
        throw new Error(`${at}.obj must name one or more object types (e.g. "creep")`)
      }
      element.obj = (objList as string[]).map((o) => o.trim())
      if (e.owner !== undefined) {
        if (e.owner !== 'own' && e.owner !== 'foreign') throw new Error(`${at}.owner may only be "own" or "foreign"`)
        element.owner = e.owner
      }
    }

    if (e.needs !== undefined) {
      if (!Array.isArray(e.needs) || e.needs.some((n) => !NEEDS.includes(n as CustomUiNeed))) {
        throw new Error(`${at}.needs may only contain ${NEEDS.join(', ')}`)
      }
      element.needs = e.needs as CustomUiNeed[]
    }

    if (e.showIf !== undefined) {
      if (typeof e.showIf !== 'object' || e.showIf === null || Array.isArray(e.showIf)) {
        throw new Error(`${at}.showIf must be an object`)
      }
      const s = e.showIf as Record<string, unknown>
      const showIf: CustomUiShowIf = {}
      if (s.selType !== undefined) {
        if (typeof s.selType !== 'string' || !s.selType.trim()) throw new Error(`${at}.showIf.selType must be a string`)
        showIf.selType = s.selType.trim()
      }
      if (s.room !== undefined) {
        // Accept a single standing or an array of standings
        const list = Array.isArray(s.room) ? s.room : [s.room]
        if (list.length === 0 || list.some((r) => !ROOM_STANDINGS.includes(r as CustomUiRoomStanding))) {
          throw new Error(`${at}.showIf.room may only contain ${ROOM_STANDINGS.join(', ')}`)
        }
        showIf.room = list as CustomUiRoomStanding[]
      }
      element.showIf = showIf
    }

    return element
  })
}

export function parseConfig(data: string): CustomUiConfig {
  if (!data || !data.trim()) throw new Error('segment is empty')
  let raw: unknown
  try {
    raw = JSON.parse(data)
  } catch {
    throw new Error('segment is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('segment must hold a JSON object')
  const cfg = raw as Record<string, unknown>
  if (cfg.v !== 1) throw new Error('unsupported config version (expected "v": 1)')
  if (typeof cfg.handler !== 'string' || !HANDLER_RE.test(cfg.handler)) {
    throw new Error('"handler" must be a function name like "uiCommand"')
  }
  return {
    handler: cfg.handler,
    map: parseElements(cfg.map, 'map'),
    room: parseElements(cfg.room, 'room'),
    objects: parseElements(cfg.objects, 'objects', { allowItems: false, objectMode: true }),
  }
}

export async function loadCustomUi(): Promise<void> {
  const c = client()
  const segment = uiSegment()
  if (!c || segment === null) {
    setUiConfig(null)
    setUiError(null)
    return
  }
  setUiLoading(true)
  try {
    const res = await c.http.user.memory.segment.get(segment, uiShard() || null)
    setUiConfig(parseConfig(res.data))
    setUiError(null)
    log(`loaded custom UI from segment ${segment}`)
  } catch (err) {
    setUiConfig(null)
    setUiError(`Segment ${segment}: ${(err as Error).message}`)
    warn('config load failed:', err)
  } finally {
    setUiLoading(false)
  }
}

interface PendingCommand {
  cmd: string
  shard: string | null
  timer: number
}

const pending = new Map<string, PendingCommand>()
// Reactive mirror of pending's key set so the panel can render in-flight state
const [pendingIds, setPendingIds] = createSignal<ReadonlySet<string>>(new Set())
export { pendingIds }

function syncPendingIds(): void {
  setPendingIds(new Set(pending.keys()))
}

let subscriptions: SubscriptionGroup | null = null

// Log lines may arrive with HTML markup, HTML-escaped entities, or as quoted
// strings with escaped quotes, depending on server and channel. A real HTML
// parse (detached document — scripts never execute, nothing is inserted into
// the page) strips markup and decodes entities in one correct step, avoiding
// the pitfalls of regex-based sanitization.
function stripLine(line: string): string {
  if (!line.includes('<') && !line.includes('&')) return line.trim()
  const doc = new DOMParser().parseFromString(line, 'text/html')
  return (doc.body.textContent ?? '').trim()
}

// A successfully parsed protocol line, hidden from the console panel. Lines
// where the marker appears but parsing fails stay visible so problems can be
// diagnosed in the log pane.
export function isCustomUiLine(line: string): boolean {
  return uiSegment() !== null && parseProtocolLine(line) !== null
}

function parseProtocolLine(line: string): Record<string, unknown> | null {
  // Fast pre-check on the raw line (the marker is plain letters, so neither
  // tags nor entity encoding can hide it) — keeps the DOM parse off the hot
  // path where this runs for every visible console line.
  if (!line.includes(MARKER)) return null
  const text = stripLine(line)
  const marker = text.indexOf(MARKER)
  if (marker === -1) return null
  const start = text.indexOf('{', marker)
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  const body = text.slice(start, end + 1)
  // Second candidate: the line was a JSON-stringified string (e.g. a results
  // line), leaving the object's quotes escaped.
  for (const candidate of [body, body.replace(/\\"/g, '"')]) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
    } catch {
      // try next candidate
    }
  }
  return null
}

function applyResponse(resp: Record<string, unknown>, cmd: PendingCommand): void {
  let acted = false
  if (typeof resp.err === 'string') {
    addToast(resp.err, 'error')
    acted = true
  } else if (typeof resp.msg === 'string') {
    addToast(resp.msg, 'success')
    acted = true
  }
  if (typeof resp.room === 'string') {
    const shard = typeof resp.shard === 'string' ? resp.shard : cmd.shard
    client()?.stores.navigation.navigateTo(resp.room, shard)
    acted = true
  }
  if (typeof resp.console === 'string') {
    insertConsole(resp.console)
    acted = true
  }
  if (resp.reload === true) {
    void loadCustomUi()
    acted = true
  }
  if (!acted) addToast(`${cmd.cmd}: done`, 'success')
}

function handleConsoleMessage(msg: ConsoleMessage): void {
  for (const line of [...(msg.log ?? []), ...(msg.results ?? [])]) {
    if (!line.includes(MARKER)) continue
    const resp = parseProtocolLine(line)
    if (!resp) {
      warn('marker found but line not parseable:', line)
      continue
    }
    if (typeof resp.id !== 'string') {
      warn('response has no "id":', line)
      continue
    }
    const cmd = pending.get(resp.id)
    if (!cmd) {
      // Expected whenever another window (a map popout, the main window) sent
      // the command: every window sees the console stream, only the sender
      // knows the id.
      log(`response id "${resp.id}" matches no pending command here`)
      continue
    }
    window.clearTimeout(cmd.timer)
    pending.delete(resp.id)
    syncPendingIds()
    applyResponse(resp, cmd)
  }
}

/** Sends the command; returns the correlation id, or null when nothing was sent. */
export function dispatchCustomUi(element: CustomUiElement, ctx: CustomUiContext, value?: string): string | null {
  const c = client()
  const config = uiConfig()
  if (!c || !config || !element.cmd) return null
  const cmd = element.cmd
  // Not crypto.randomUUID(): unavailable outside secure contexts, and the
  // embedded client is often served over plain HTTP from private servers.
  const id = Math.random().toString(36).slice(2, 10)
  const expression = `${config.handler}(${JSON.stringify({ id, cmd, ...(value !== undefined ? { value } : {}), ctx })})`
  const timer = window.setTimeout(() => {
    pending.delete(id)
    syncPendingIds()
    addToast(`${cmd}: no response`, 'error')
  }, RESPONSE_TIMEOUT_MS)
  pending.set(id, { cmd, shard: ctx.shard, timer })
  syncPendingIds()
  log('dispatch:', expression)
  c.http.user.console(expression, ctx.shard).catch((err: Error) => {
    window.clearTimeout(timer)
    pending.delete(id)
    syncPendingIds()
    addToast(`${cmd}: ${err.message}`, 'error')
  })
  return id
}

export function initCustomUi(): void {
  if (isGuest()) return
  const c = client()
  if (!c) return
  setUiSegmentSignal(readPersistedSegment())
  setUiShardSignal(getStr(shardKey()) ?? '')
  subscriptions = new SubscriptionGroup()
  subscriptions.add(c.stores.user.subscribe('console'))
  // eslint-disable-next-line solid/reactivity -- socket event handler; signals it touches are read fresh per event, not tracked
  subscriptions.add(c.stores.user.on('user:console', (data) => {
    handleConsoleMessage(data.messages as ConsoleMessage)
  }))
  void loadCustomUi()
}

export function disposeCustomUi(): void {
  subscriptions?.dispose()
  subscriptions = null
  for (const cmd of pending.values()) window.clearTimeout(cmd.timer)
  pending.clear()
  syncPendingIds()
  setUiConfig(null)
  setUiError(null)
  setUiLoading(false)
}
