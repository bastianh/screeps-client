import { For, Show } from 'solid-js'
import { showMapRoomNames, setShowMapRoomNames, showUnclaimableRooms, setShowUnclaimableRooms, showMapVisuals, setShowMapVisuals, showRoomDecorations, setShowRoomDecorations } from '~/stores/settingsStore.js'
import { mapOverlayMode, setMapOverlayMode, type MapOverlayMode } from '~/stores/mapOverlayStore.js'
import { NAME_ZOOM_THRESHOLD } from '~/renderer/MapRenderer.js'
import { serverVersion, isPrivateServer } from '~/stores/clientStore.js'

interface MapInfoPanelProps {
  zoom?: number | null
  subsActive?: boolean | null
  shard?: string | null
  onShardChange?: (shard: string) => void
}

const OVERLAY_MODES: Array<{ mode: MapOverlayMode; label: string }> = [
  { mode: 'owner', label: 'Owner' },
  { mode: 'mineral', label: 'Mineral' },
  { mode: 'none', label: 'None' },
]

export function MapInfoPanel(props: MapInfoPanelProps) {
  const namesEnabled = () => (props.zoom ?? 1) >= NAME_ZOOM_THRESHOLD
  const shards = () => serverVersion()?.serverData?.shards?.filter((s): s is string => s !== null) ?? []
  const multiShard = () => isPrivateServer() === false && shards().length > 1

  return (
    <div style={{ padding: '8px', 'border-bottom': '1px solid #30363d', 'flex-shrink': 0 }}>
      <Show when={multiShard()}>
        <div style={{ 'margin-bottom': '8px' }}>
          <select
            value={props.shard ?? ''}
            onChange={(e) => props.onShardChange?.(e.currentTarget.value)}
            style={{
              width: '100%',
              padding: '5px 8px',
              background: '#161b22',
              border: '1px solid #30363d',
              'border-radius': '6px',
              color: '#c9d1d9',
              'font-size': '12px',
              cursor: 'pointer',
            }}
          >
            <For each={shards()}>
              {(s) => <option value={s}>{s}</option>}
            </For>
          </select>
        </div>
      </Show>
      <div
        style={{
          padding: '4px 8px',
          background: '#161b22',
          'border-radius': '6px',
          border: '1px solid #30363d',
        }}
      >
        <div
          style={{
            'font-size': '10px',
            'font-weight': 600,
            color: '#8b949e',
            'text-transform': 'uppercase',
            'letter-spacing': '0.04em',
            'margin-bottom': '4px',
          }}
        >
          Map
        </div>

        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'auto 1fr',
            'row-gap': '1px',
            'font-size': '11px',
            'margin-bottom': '8px',
          }}
        >
          <div style={{ padding: '3px 0', color: '#8b949e' }}>Zoom</div>
          <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{props.zoom?.toFixed(2) ?? '—'}</div>
          <div style={{ padding: '3px 0', color: '#8b949e' }}>Live</div>
          <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{props.subsActive ? 'Yes' : 'No'}</div>
        </div>

        <label
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'font-size': '11px',
            color: namesEnabled() ? '#c9d1d9' : '#484f58',
            cursor: namesEnabled() ? 'pointer' : 'default',
          }}
        >
          <span>Show room names</span>
          <input
            type="checkbox"
            checked={showMapRoomNames()}
            disabled={!namesEnabled()}
            onChange={(e) => setShowMapRoomNames(e.currentTarget.checked)}
          />
        </label>
        <label
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'font-size': '11px',
            color: '#c9d1d9',
            cursor: 'pointer',
            'margin-top': '4px',
          }}
        >
          <span>Show unclaimable rooms</span>
          <input
            type="checkbox"
            checked={showUnclaimableRooms()}
            onChange={(e) => setShowUnclaimableRooms(e.currentTarget.checked)}
          />
        </label>
        <label
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'font-size': '11px',
            color: '#c9d1d9',
            cursor: 'pointer',
            'margin-top': '4px',
          }}
        >
          <span>Show map visuals</span>
          <input
            type="checkbox"
            checked={showMapVisuals()}
            onChange={(e) => setShowMapVisuals(e.currentTarget.checked)}
          />
        </label>
        <label
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'font-size': '11px',
            color: '#c9d1d9',
            cursor: 'pointer',
            'margin-top': '4px',
          }}
        >
          <span>Room decorations</span>
          <input
            type="checkbox"
            checked={showRoomDecorations()}
            onChange={(e) => setShowRoomDecorations(e.currentTarget.checked)}
          />
        </label>
      </div>

      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(3, 1fr)',
          gap: '4px',
          'margin-top': '8px',
        }}
      >
        <For each={OVERLAY_MODES}>
          {(entry) => {
            const active = () => mapOverlayMode() === entry.mode
            return (
              <button
                type="button"
                onClick={() => setMapOverlayMode(entry.mode)}
                style={{
                  padding: '5px 8px',
                  'border-radius': '6px',
                  border: `1px solid ${active() ? '#58a6ff' : '#30363d'}`,
                  background: active() ? '#1f6feb33' : '#161b22',
                  color: active() ? '#c9d1d9' : '#8b949e',
                  cursor: 'pointer',
                  'font-size': '11px',
                  'font-weight': 600,
                }}
              >
                {entry.label}
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
