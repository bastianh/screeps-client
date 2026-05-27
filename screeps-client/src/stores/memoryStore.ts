import { createSignal, createEffect, createRoot, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Subscription } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { selection } from '~/stores/selectionStore.js'
import { LS, getJson, setJson } from '~/utils/storage.js'

export interface TempWatch {
  creepId: string
  name: string
}

const [watches, setWatches] = createSignal<string[]>(getJson(LS.memoryWatches, []))
const [tempWatch, setTempWatch] = createSignal<TempWatch | null>(null)
const [memoryValues, setMemoryValues] = createStore<Record<string, unknown>>({})

export { watches, tempWatch, memoryValues, setMemoryValues }

export function addWatch(path: string): void {
  const trimmed = path.trim()
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
      setMemoryValues(data.path, data.value)
    })
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
