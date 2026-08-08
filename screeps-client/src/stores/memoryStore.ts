import { createSignal, createEffect, createRoot, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { Subscription } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { selection } from '~/stores/selectionStore.js'
import { LS, getJson, setJson } from '~/utils/storage.js'

export interface TempWatch {
  creepId: string
  name: string
}

const [watches, setWatches] = createSignal<string[]>(getJson(LS.memoryWatches, []))

// The watch list is shared with popout windows through localStorage; pick up
// their edits (storage events only fire in the windows that didn't write).
window.addEventListener('storage', (event) => {
  if (event.key === LS.memoryWatches) setWatches(getJson(LS.memoryWatches, []))
})
const [tempWatch, setTempWatch] = createSignal<TempWatch | null>(null)
const [memoryValues, setMemoryValues] = createStore<Record<string, unknown>>({})

export { watches, tempWatch, memoryValues, setMemoryValues }

export function addWatch(path: string): void {
  // Accept JS-style bracket access ("creeps['John']", "list[3]") but store the
  // dot form, which is what the server's path resolution understands
  const trimmed = path.trim()
    .replace(/\[(?:'([^']*)'|"([^"]*)"|(\d+))\]/g, (_m, sq, dq, idx) => `.${sq ?? dq ?? idx}`)
  if (!trimmed) return
  setWatches((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed])
  setJson(LS.memoryWatches, watches())
}

export function removeWatch(path: string): void {
  setWatches((prev) => prev.filter((p) => p !== path))
  setJson(LS.memoryWatches, watches())
}

export function clearTempWatch(): void {
  setTempWatch(null)
}

export function setTempWatchFor(creepId: string, name: string): void {
  setTempWatch({ creepId, name })
}

/** Returns the active watch paths: persisted list + temp creep path (if set) */
export function activePaths(tw: TempWatch | null, ws: string[]): string[] {
  const paths = [...ws]
  if (tw) {
    const creepPath = `creeps.${tw.name}`
    if (!paths.includes(creepPath)) paths.push(creepPath)
  }
  return paths
}

/**
 * Some private servers string-coerce objects on the HTTP endpoint too. Keep the
 * sentinel the tree understands so the node stays expandable and can pull its
 * children in with a follow-up request for the deeper path.
 */
function normalize(value: unknown): unknown {
  return value === '[object Object]' ? { __screeps_object__: true } : value
}

function setTypedValue(path: string, value: unknown): void {
  const next = normalize(value)
  // Object values must replace, not merge — a plain store set would keep keys
  // that were deleted from Memory visible forever
  if (next !== null && typeof next === 'object') setMemoryValues(path, reconcile(next))
  else setMemoryValues(path, next)
}

/** Rebuild `node` with the value at `segments` replaced. Untouched branches keep
 *  their identity so the reconcile below skips them. */
function replaceAt(node: unknown, segments: (string | number)[], value: unknown): unknown {
  if (segments.length === 0) return normalize(value)
  if (node === null || typeof node !== 'object') return node
  const [head, ...rest] = segments
  if (Array.isArray(node)) {
    const copy = [...node]
    const idx = Number(head)
    copy[idx] = replaceAt(copy[idx], rest, value)
    return copy
  }
  const obj = node as Record<string, unknown>
  return { ...obj, [head]: replaceAt(obj[head], rest, value) }
}

/**
 * Write a value fetched for a nested path back into its watch tree, addressed by
 * the keys leading from the watch root down to the node. Used by the per-node
 * reload buttons in the memory tree, which fetch a single subtree over HTTP.
 */
export function setMemoryValueAt(rootPath: string, segments: (string | number)[], value: unknown): void {
  if (segments.length === 0) {
    setTypedValue(rootPath, value)
    return
  }
  const root = memoryValues[rootPath]
  if (root === null || typeof root !== 'object') return
  setTypedValue(rootPath, replaceAt(root, segments, value))
}

// In-flight typed fetches; overlapping change signals for a path coalesce into
// at most one follow-up request
const inflight = new Map<string, { again: boolean }>()

/**
 * Load the typed value for a watch path over HTTP and store it. The WS watch
 * channel string-coerces values (matching the official server), so it serves
 * only as a change signal; this fetch is what actually fills the tree.
 */
async function refreshPath(path: string, shard: string | null): Promise<void> {
  const entry = inflight.get(path)
  if (entry) {
    entry.again = true
    return
  }
  const state = { again: false }
  inflight.set(path, state)
  try {
    const c = client()
    if (!c) return
    const res = await c.http.user.memory.get(path, shard)
    setTypedValue(path, res.data)
  } catch (err) {
    console.warn('[memoryStore] memory fetch failed', path, err)
  } finally {
    inflight.delete(path)
    if (state.again) void refreshPath(path, shard)
  }
}

/**
 * Call this once when the Memory pane mounts. Manages subscriptions for all
 * active watch paths and writes incoming values into memoryValues.
 * Returns a dispose function to tear everything down on unmount.
 */
export function initMemorySubscriptions(shard: string | null): () => void {
  const subscriptions = new Map<string, Subscription>()

  const sync = () => {
    const c = client()
    if (!c) return
    const desired = new Set(activePaths(tempWatch(), watches()))

    // subscribe new paths
    for (const path of desired) {
      if (!subscriptions.has(path)) {
        subscriptions.set(path, c.stores.user.subscribeMemory(path, shard))
        // Eager first load — the first change signal only arrives on the next tick
        void refreshPath(path, shard)
      }
    }
    // dispose removed paths
    for (const [path, sub] of subscriptions) {
      if (!desired.has(path)) {
        sub.dispose()
        subscriptions.delete(path)
      }
    }
  }

  // React to watch list and temp watch changes
  createEffect(() => {
    watches()
    tempWatch()
    sync()
  })

  // Listen to all incoming memory events
  const c = client()
  let listenerSub: Subscription | null = null
  if (c) {
    listenerSub = c.stores.user.on('user:memory', (data) => {
      void refreshPath(data.path, data.shard)
    })
  } else {
    console.warn('[memoryStore] no client available when initMemorySubscriptions called')
  }

  onCleanup(() => {
    for (const sub of subscriptions.values()) sub.dispose()
    subscriptions.clear()
    listenerSub?.dispose()
  })

  // Initial sync
  sync()

  return () => {
    for (const sub of subscriptions.values()) sub.dispose()
    subscriptions.clear()
    listenerSub?.dispose()
  }
}

// Auto-remove temp watch when the watched creep is deselected (app-lifetime effect)
createRoot(() => {
  createEffect(() => {
    const tw = tempWatch()
    if (!tw) return
    const sel = selection()
    if (!sel.some((item) => item.id === tw.creepId)) {
      clearTempWatch()
    }
  })
})
