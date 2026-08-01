import { For, Show, createMemo } from 'solid-js'
import type { ApiRoomDecorationItem } from 'screeps-connectivity'
import { roomDecorationItems, roomUsers } from '~/stores/roomDataStore.js'
import { showRoomDecorations } from '~/stores/settingsStore.js'
import { userInfo } from '~/stores/clientStore.js'
import { capabilities } from '~/stores/capabilities.js'
import { goToInventory } from '~/stores/routeStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { beginDecorationEdit } from '~/stores/decorationEditStore.js'
import { UserLink } from '~/components/UserLink.js'
import { DECORATION_TYPE_LABELS as TYPE_LABELS, rarityColor } from '~/components/inventory/sorting.js'

// Types the panel lists — the ones that are visibly placed in this room. `creep` and
// `badge` are globally active rather than room-bound, so the reference client leaves
// them out here too; creep overlays show on the selected creep instead.
const LISTED_TYPES = new Set(['floorLandscape', 'wallLandscape', 'landscape', 'wallGraffiti', 'object'])

function DecorationRow(props: { item: ApiRoomDecorationItem }) {
  const decoration = () => props.item.decoration
  const preview = () => decoration().preview?.['128x128'] ?? decoration().preview?.original
  const owner = () => roomUsers()?.[props.item.user]

  // Only your own decorations can be edited, and only where the server has an inventory
  // at all. `game/room-decorations` returns the same user-decoration records the
  // inventory does, so their `_id` addresses the editor directly.
  const editable = () => capabilities().hasInventory && props.item.user === userInfo()?._id

  // Editing happens in the room itself; history playback is a read-only view of a past
  // tick, so there it falls back to the inventory dialog.
  const edit = () => {
    if (!editable()) return
    if (historyMode()) {
      goToInventory(props.item._id)
      return
    }
    beginDecorationEdit({
      _id: props.item._id,
      decoration: decoration(),
      active: props.item.active,
      wasActive: true,
    })
  }

  return (
    <div
      onClick={edit}
      title={editable() ? 'Edit' : undefined}
      style={{
        display: 'flex', gap: '8px', 'align-items': 'center',
        padding: '4px 0', 'border-top': '1px solid #21262d',
        cursor: editable() ? 'pointer' : 'default',
      }}
    >
      <Show when={preview()} fallback={
        <div style={{
          width: '28px', height: '28px', 'border-radius': '4px', 'flex-shrink': 0,
          background: '#0d1117', border: `1px solid ${rarityColor(decoration().rarity)}`,
        }} />
      }>
        <img
          src={preview()}
          alt=""
          style={{
            width: '28px', height: '28px', 'border-radius': '4px', 'flex-shrink': 0,
            background: '#0d1117', border: `1px solid ${rarityColor(decoration().rarity)}`,
            'object-fit': 'cover',
          }}
        />
      </Show>
      <div style={{ 'min-width': 0, flex: 1 }}>
        <div style={{
          'font-size': '11px', color: '#c9d1d9',
          overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap',
        }}>
          {decoration().name ?? TYPE_LABELS[decoration().type] ?? decoration().type}
        </div>
        <div style={{ 'font-size': '10px', color: '#8b949e' }}>
          {TYPE_LABELS[decoration().type] ?? decoration().type}
          {' · '}
          <UserLink username={owner()?.username} fallback={props.item.user} color="#8b949e" />
        </div>
      </div>
    </div>
  )
}

/**
 * Lists the decorations placed in the current room, for decorate mode's sidebar. Hidden
 * when there are none.
 */
export function RoomDecorationsPanel() {
  const items = createMemo(() => roomDecorationItems().filter(i => LISTED_TYPES.has(i.decoration.type)))

  return (
    <Show when={showRoomDecorations() && items().length > 0}>
      <div style={{ padding: '0 8px 8px', 'flex-shrink': 0 }}>
        <div style={{
          padding: '4px 8px', background: '#161b22', 'border-radius': '6px', border: '1px solid #30363d',
        }}>
          <div style={{
            'font-size': '10px', 'font-weight': 600, color: '#8b949e',
            'text-transform': 'uppercase', 'letter-spacing': '0.04em', 'margin-bottom': '2px',
          }}>
            Decorations
          </div>
          <For each={items()}>{item => <DecorationRow item={item} />}</For>
        </div>
      </div>
    </Show>
  )
}
