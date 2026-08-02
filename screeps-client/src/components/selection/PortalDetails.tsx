import { Show } from 'solid-js'
import { client, gameTime } from '~/stores/clientStore.js'
import { currentShard } from '~/stores/roomDataStore.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { kvCell, kvGrid } from './shared.js'

// Portals carry a `destination` that is either inter-shard ({shard, room}) or in-shard
// ({room, x, y}); vanilla shows the destination as a link and, for inter-shard portals,
// how long the portal still has before it decays (they are stable until `decayTime` is set).
export function PortalDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const destination = () => {
    const d = raw().destination
    return d && typeof d === 'object' ? d as Record<string, unknown> : null
  }
  const destRoom = () => {
    const r = destination()?.room
    return typeof r === 'string' ? r : null
  }
  const destShard = () => {
    const s = destination()?.shard
    return typeof s === 'string' ? s : null
  }
  const destPos = () => {
    const d = destination()
    if (typeof d?.x !== 'number' || typeof d.y !== 'number') return null
    return { x: d.x as number, y: d.y as number }
  }

  const destLabel = () => {
    const room = destRoom()
    if (!room) return null
    const shard = destShard()
    if (shard) return `${shard} / ${room}`
    const pos = destPos()
    return pos ? `${room} (${pos.x}, ${pos.y})` : room
  }

  const goToDestination = () => {
    const room = destRoom()
    if (!room) return
    client()?.stores.navigation.navigateTo(room, destShard() ?? currentShard())
  }

  // Absolute tick the portal vanishes; unset while the portal is still stable.
  const decayCountdown = () => {
    const dt = raw().decayTime
    if (typeof dt !== 'number') return null
    const gt = gameTime()
    return gt !== null ? Math.max(0, dt - gt) : dt
  }

  return (
    <div style={kvGrid}>
      <Show when={destLabel()}>
        <>
          <div style={kvCell(true)}>Destination</div>
          <div
            style={{ ...kvCell(), color: '#58a6ff', cursor: 'pointer' }}
            title="Go to destination room"
            onClick={(e) => { e.stopPropagation(); goToDestination() }}
          >
            {destLabel()}
          </div>
        </>
      </Show>
      <div style={kvCell(true)}>Decay in</div>
      <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
        {decayCountdown() ?? 'stable'}
      </div>
    </div>
  )
}
