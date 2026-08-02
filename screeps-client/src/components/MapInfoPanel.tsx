import { For, Match, Show, Switch, createEffect, createMemo } from 'solid-js'
import { showMapRoomNames, setShowMapRoomNames, showUnclaimableRooms, setShowUnclaimableRooms, showMapVisuals, setShowMapVisuals, showRoomDecorations, setShowRoomDecorations } from '~/stores/settingsStore.js'
import { mapOverlayMode, setMapOverlayMode, type MapOverlayMode } from '~/stores/mapOverlayStore.js'
import { NAME_ZOOM_THRESHOLD } from '~/renderer/MapRenderer.js'
import { serverVersion, isPrivateServer } from '~/stores/clientStore.js'
import { alliances, allianceRoomCounts, allianceStatus, hexColor } from '~/stores/allianceStore.js'

interface MapInfoPanelProps {
  zoom?: number | null
  subsActive?: boolean | null
  shard?: string | null
  onShardChange?: (shard: string) => void
}

const OVERLAY_MODES: Array<{ mode: MapOverlayMode; label: string }> = [
  { mode: 'owner', label: 'Owner' },
  { mode: 'mineral', label: 'Mineral' },
  { mode: 'alliance', label: 'Alliance' },
  { mode: 'none', label: 'None' },
]

export function MapInfoPanel(props: MapInfoPanelProps) {
  const namesEnabled = () => (props.zoom ?? 1) >= NAME_ZOOM_THRESHOLD
  const shards = () => serverVersion()?.serverData?.shards?.filter((s): s is string => s !== null) ?? []
  const multiShard = () => isPrivateServer() === false && shards().length > 1
  // Busiest alliance in the current viewport first; ties and empties fall back to
  // alphabetical so the list doesn't reshuffle arbitrarily while panning.
  const sortedAlliances = createMemo(() => {
    const counts = allianceRoomCounts()
    return [...alliances().values()]
      .map((alliance) => ({ alliance, rooms: counts.get(alliance.abbreviation) ?? 0 }))
      .sort((a, b) =>
        b.rooms - a.rooms || a.alliance.abbreviation.localeCompare(b.alliance.abbreviation),
      )
  })

  // The LOAN roster only describes the official MMO, so the overlay is dead weight
  // on a private server. `null` means the version probe hasn't answered yet — show
  // the button rather than making it pop in late on the server where it does work.
  const overlayModes = createMemo(() =>
    isPrivateServer() === true ? OVERLAY_MODES.filter((m) => m.mode !== 'alliance') : OVERLAY_MODES,
  )

  // Connecting to a private server while the alliance overlay is active would leave
  // the map tinted with no way back to it — fall back to the default.
  createEffect(() => {
    if (isPrivateServer() === true && mapOverlayMode() === 'alliance') setMapOverlayMode('owner')
  })

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
          // 4 modes tile as 2×2; without the alliance button they fit one row.
          'grid-template-columns': `repeat(${overlayModes().length === 4 ? 2 : 3}, 1fr)`,
          gap: '4px',
          'margin-top': '8px',
        }}
      >
        <For each={overlayModes()}>
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

      <Show when={mapOverlayMode() === 'alliance'}>
        <style>{`
          .alliance-scroll {
            scrollbar-width: thin;
            scrollbar-color: #484f58 #161b22;
          }
          .alliance-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .alliance-scroll::-webkit-scrollbar-track {
            background: #161b22;
          }
          .alliance-scroll::-webkit-scrollbar-thumb {
            background: #484f58;
            border-radius: 4px;
          }
          .alliance-scroll::-webkit-scrollbar-thumb:hover {
            background: #6e7681;
          }
        `}</style>
        <div
          style={{
            'margin-top': '8px',
            padding: '6px 8px',
            background: '#161b22',
            'border-radius': '6px',
            border: '1px solid #30363d',
            'font-size': '11px',
          }}
        >
          <Switch>
            <Match when={allianceStatus() === 'loading' || allianceStatus() === 'idle'}>
              <div style={{ color: '#8b949e' }}>Loading alliances…</div>
            </Match>
            <Match when={allianceStatus() === 'error'}>
              <div style={{ color: '#f85149' }}>Alliance data unavailable</div>
            </Match>
            <Match when={allianceStatus() === 'ready'}>
              <div
                title="Owned rooms inside the current viewport"
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  // Matches the list's own padding + reserved scrollbar gutter below,
                  // so the header stays lined up with the counts.
                  'padding-right': '14px',
                  'margin-bottom': '3px',
                  color: '#8b949e',
                  'font-size': '10px',
                  'text-transform': 'uppercase',
                  'letter-spacing': '0.04em',
                }}
              >
                <span>Alliance</span>
                <span>In view</span>
              </div>
              <div
                class="alliance-scroll"
                style={{
                  'max-height': '180px',
                  'overflow-y': 'auto',
                  'padding-right': '6px',
                  // Reserve the gutter whether or not the list overflows, so the
                  // header alignment doesn't shift as alliances come into view.
                  'scrollbar-gutter': 'stable',
                }}
              >
                <For each={sortedAlliances()}>
                  {(row) => (
                    <div
                      title={`${row.alliance.name}\n${row.rooms} rooms in view`}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '6px',
                        padding: '2px 0',
                        // Nothing in view — keep the colour mapping readable, just quieter.
                        opacity: row.rooms > 0 ? 1 : 0.4,
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          'border-radius': '2px',
                          background: hexColor(row.alliance.color),
                          flex: '0 0 auto',
                        }}
                      />
                      <span
                        style={{
                          color: '#c9d1d9',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                      >
                        {row.alliance.abbreviation}
                      </span>
                      <span
                        style={{
                          'margin-left': 'auto',
                          color: '#c9d1d9',
                          'font-variant-numeric': 'tabular-nums',
                          flex: '0 0 auto',
                        }}
                      >
                        {row.rooms}
                      </span>
                    </div>
                  )}
                </For>
              </div>
              <div style={{ 'margin-top': '4px', color: '#484f58', 'font-size': '10px' }}>
                Source: leagueofautomatednations.com
              </div>
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  )
}
