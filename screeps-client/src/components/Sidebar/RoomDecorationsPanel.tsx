import { For, Show, createMemo } from 'solid-js'
import type { ApiRoomDecorationItem } from 'screeps-connectivity'
import { roomDecorationItems, roomUsers } from '~/stores/roomDataStore.js'
import { showRoomDecorations } from '~/stores/settingsStore.js'
import { UserLink } from '~/components/UserLink.js'

// Types the panel lists — the ones that are visibly placed in this room. `creep` and
// `badge` are globally active rather than room-bound, so the reference client leaves
// them out here too; creep overlays show on the selected creep instead.
const LISTED_TYPES = new Set(['floorLandscape', 'wallLandscape', 'landscape', 'wallGraffiti', 'object'])

const TYPE_LABELS: Record<string, string> = {
  floorLandscape: 'Floor texture',
  wallLandscape: 'Wall texture',
  landscape: 'Landscape',
  wallGraffiti: 'Graffiti',
  object: 'Object',
}

// Rarity 1–5, common → legendary. Mirrors the reference client's rarity colouring.
const RARITY_COLORS = ['#8b949e', '#8b949e', '#58a6ff', '#a371f7', '#d29922', '#f0883e']

function rarityColor(rarity?: number): string {
  return RARITY_COLORS[rarity ?? 0] ?? RARITY_COLORS[0]
}

function DecorationRow(props: { item: ApiRoomDecorationItem }) {
  const decoration = () => props.item.decoration
  const preview = () => decoration().preview?.['128x128'] ?? decoration().preview?.original
  const owner = () => roomUsers()?.[props.item.user]

  return (
    <div style={{
      display: 'flex', gap: '8px', 'align-items': 'center',
      padding: '4px 0', 'border-top': '1px solid #21262d',
    }}>
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

/** Lists the decorations placed in the current room. Hidden when there are none. */
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
