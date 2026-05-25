import { createSignal } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { RoomObject } from 'screeps-connectivity'

export interface SelectedObject {
  id: string
  type: string
  raw: RoomObject
}

const setters = new WeakMap<SelectedObject, (value: RoomObject) => void>()

export function createSelectedObject(id: string, obj: RoomObject): SelectedObject {
  const [raw, setRaw] = createStore<RoomObject>(obj)
  const wrapper: SelectedObject = {
    id,
    type: obj.type,
    raw,
  }
  setters.set(wrapper, (value) => setRaw(reconcile(value, { key: '_id', merge: false })))
  return wrapper
}

const [selection, setSelection] = createSignal<SelectedObject[]>([])

export { selection, setSelection }

export function clearSelection(): void {
  setSelection([])
}

export function deselectItem(id: string): void {
  setSelection((prev) => prev.filter((item) => item.id !== id))
}

export function updateSelectionWithDiff(
  diff: Record<string, Partial<RoomObject> | null>,
  objects: Record<string, RoomObject>
): void {
  const current = selection()
  let removed = false
  const next: SelectedObject[] = []
  for (const item of current) {
    const itemDiff = diff[item.id]
    if (itemDiff === null) {
      removed = true
      continue
    }
    if (itemDiff !== undefined) {
      const updated = objects[item.id]
      if (updated) {
        const setRaw = setters.get(item)
        setRaw?.(updated)
      }
    }
    next.push(item)
  }
  if (removed) setSelection(next)
}

export function updateSelectionFromObjects(objects: Record<string, RoomObject>): void {
  const current = selection()
  if (current.length === 0) return
  let removed = false
  const next: SelectedObject[] = []
  for (const item of current) {
    const updated = objects[item.id]
    if (!updated) {
      removed = true
      continue
    }
    setters.get(item)?.(updated)
    next.push(item)
  }
  if (removed) setSelection(next)
}
