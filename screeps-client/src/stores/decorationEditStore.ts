import { createEffect, createRoot, createSignal, untrack } from 'solid-js'
import type { ApiRoomDecorationActive, ApiRoomDecorationDef, ApiRoomDecorationItem } from 'screeps-connectivity'
import { buildActiveState } from '~/components/inventory/activation.js'
import { placeDecoration, unplaceDecoration } from '~/components/inventory/commit.js'
import {
  editorCapabilities, placementOf, sizeBounds,
  type EditorCapabilities, type Placement, type SizeBounds,
} from '~/components/inventory/positionEditor.js'
import { userInfo } from './clientStore.js'
import { roomViewMode, setRoomViewMode, resetRoomViewMode } from './roomViewStore.js'

// The decoration currently being edited straight in the room view. Only one at a time,
// and only for the room on screen — the draft is dropped the moment the view leaves
// `decorate` mode, which is also what a room change does.

/** What a caller hands over to start editing. */
export interface DecorationEditTarget {
  _id: string
  decoration: ApiRoomDecorationDef
  active: ApiRoomDecorationActive | null
  /** Whether the decoration is already placed, which decides activate vs. move. */
  wasActive: boolean
}

interface DecorationDraft {
  id: string
  decoration: ApiRoomDecorationDef
  /** Live, edited activation state. */
  active: ApiRoomDecorationActive
  /** The state editing began from, for the dirty check. */
  initial: ApiRoomDecorationActive
  /**
   * Placement editing began from. The renderer keeps drawing this one and gets the live
   * geometry pushed to it directly, so dragging never rebuilds the decoration layer.
   */
  original: Placement
  wasActive: boolean
}

const [decorationDraft, setDecorationDraft] = createSignal<DecorationDraft | null>(null)
const [decorationBusy, setDecorationBusy] = createSignal(false)

// Leaving decorate mode — by right-click, by a room change, by any other mode taking
// over — abandons the draft. Keeping the teardown here means `roomViewStore` needs no
// knowledge of decorations.
createRoot(() => {
  createEffect(() => {
    if (roomViewMode() !== 'decorate') setDecorationDraft(null)
  })
})

export { decorationDraft, decorationBusy }

export function draftPlacement(): Placement | null {
  const draft = decorationDraft()
  return draft ? placementOf(draft.active) : null
}

export function draftCapabilities(): EditorCapabilities | null {
  const draft = decorationDraft()
  return draft ? editorCapabilities(draft.decoration) : null
}

export function draftBounds(): SizeBounds | null {
  const draft = decorationDraft()
  return draft ? sizeBounds(draft.decoration) : null
}

/** Does this decoration have geometry to drag at all? Landscapes do not. */
export function draftHasFrame(): boolean {
  const caps = draftCapabilities()
  return caps != null && (caps.positionable || caps.resizable || caps.rotatable)
}

export function draftDirty(): boolean {
  const draft = decorationDraft()
  if (!draft) return false
  return JSON.stringify(draft.active) !== JSON.stringify(draft.initial)
}

/**
 * The draft as a room-decoration item, for the renderer to draw instead of the stored
 * one. Geometry is pinned to where editing began: a drag is pushed to the layer directly
 * rather than through here, so that moving a decoration never costs a layer rebuild.
 */
export function decorationPreviewItem(): ApiRoomDecorationItem | null {
  const draft = decorationDraft()
  if (!draft) return null
  return {
    _id: draft.id,
    user: userInfo()?._id ?? '',
    decoration: draft.decoration,
    active: { ...draft.active, ...draft.original },
  }
}

export function beginDecorationEdit(target: DecorationEditTarget): void {
  const active = buildActiveState(target.decoration, target.active)
  setDecorationDraft({
    id: target._id,
    decoration: target.decoration,
    active,
    initial: active,
    original: placementOf(active),
    wasActive: target.wasActive,
  })
  setRoomViewMode('decorate')
}

export function setDraftPlacement(placement: Placement): void {
  setDecorationDraft(prev => prev ? { ...prev, active: { ...prev.active, ...placement } } : prev)
}

export function setDraftProp(name: string, value: unknown): void {
  setDecorationDraft(prev => prev ? { ...prev, active: { ...prev.active, [name]: value } } : prev)
}

export function cancelDecorationEdit(): void {
  resetRoomViewMode()
}

/**
 * Push the draft to the server, and stay in the editor.
 *
 * Closing on success would drop the draft before the re-read it triggers comes back, and
 * the decoration would visibly snap to its old spot for as long as that takes. Adopting
 * the saved state as the new baseline avoids that, and leaves the editor where an editor
 * belongs after a save: open, and no longer dirty.
 */
export async function saveDecorationEdit(): Promise<void> {
  const draft = untrack(decorationDraft)
  if (!draft || untrack(decorationBusy)) return

  setDecorationBusy(true)
  const saved = draft.active
  const ok = await placeDecoration(draft.id, saved, draft.wasActive)
  setDecorationBusy(false)
  if (!ok) return

  setDecorationDraft(prev => prev && prev.id === draft.id
    ? { ...prev, initial: saved, original: placementOf(saved), wasActive: true }
    : prev)
}

export async function deactivateDecorationEdit(): Promise<void> {
  const draft = untrack(decorationDraft)
  if (!draft || untrack(decorationBusy)) return

  setDecorationBusy(true)
  const ok = await unplaceDecoration(draft.id)
  setDecorationBusy(false)
  if (ok) resetRoomViewMode()
}
