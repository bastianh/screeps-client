import type { ApiRoomDecorationActive } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { invalidateRoomDecorations } from '~/stores/roomDataStore.js'
import { addToast } from '~/stores/toastStore.js'

// The two server calls behind every decoration edit, shared by the inventory dialog and
// the in-room editor so both report the same thing when the server says no.

function detail(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Place a decoration, or move an already-placed one.
 *
 * The server rejects `activate` on a decoration that is already active, so editing one
 * means taking it down first — the same two-step the reference client performs behind
 * its "back edit" button. That leaves a window where the decoration is placed nowhere,
 * so a failure in the second step has to say so rather than read as "nothing happened".
 */
export async function placeDecoration(
  id: string,
  active: ApiRoomDecorationActive,
  wasActive: boolean,
): Promise<boolean> {
  const c = client()
  if (!c) return false

  let removed = false
  try {
    if (wasActive) {
      await c.http.user.decorations.deactivate([id])
      removed = true
    }
    await c.http.user.decorations.activate(id, active)
    addToast(removed ? 'Decoration moved' : 'Decoration activated', 'success')
    return true
  } catch (err) {
    addToast(
      removed
        ? `Could not place the decoration, and it is no longer in its old spot: ${detail(err)}`
        : `Could not activate: ${detail(err)}`,
      'error',
      8000,
    )
    return false
  } finally {
    // The server state may have moved either way, including on the failure path where
    // the decoration was taken down but never put back.
    invalidateRoomDecorations()
  }
}

/** Take a decoration down. */
export async function unplaceDecoration(id: string): Promise<boolean> {
  const c = client()
  if (!c) return false

  try {
    await c.http.user.decorations.deactivate([id])
    addToast('Decoration deactivated', 'success')
    return true
  } catch (err) {
    addToast(`Could not deactivate: ${detail(err)}`, 'error', 8000)
    return false
  } finally {
    invalidateRoomDecorations()
  }
}
