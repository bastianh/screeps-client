import { Show } from 'solid-js'
import { SelectionList } from '~/components/SelectionList.js'
import { RoomInfoPanel } from '~/components/RoomInfoPanel.js'
import { MapInfoPanel } from '~/components/MapInfoPanel.js'
import type { RoomInfo } from '~/components/MapViewer.js'
import { roomViewMode } from '~/stores/roomViewStore.js'
import { historyMode } from '~/stores/historyStore.js'

import { RoomInfoBox } from './RoomInfoBox.js'
import { FlagForm } from './FlagForm.js'
import { BuildPanel } from './BuildPanel.js'
import { HistoryControlPanel } from './HistoryControlPanel.js'

function RoomModePanel(props: { shard?: string | null }) {
  return (
    <Show when={roomViewMode() === 'flag'} fallback={
      <Show when={roomViewMode() === 'build'} fallback={<SelectionList />}>
        <BuildPanel shard={props.shard} />
      </Show>
    }>
      <FlagForm />
    </Show>
  )
}

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
  mapMode?: boolean
  hoveredRoomInfo?: RoomInfo | null
  selectedRoomInfo?: RoomInfo | null
  room?: string
  shard?: string | null
  mapZoom?: number | null
  mapSubsActive?: boolean | null
  onShardChange?: (shard: string) => void
}

export function Sidebar(props: SidebarProps) {
  const handleStripClick = () => {
    props.onToggle?.()
  }

  const handleButtonClick = (e: MouseEvent) => {
    e.stopPropagation()
    props.onToggle?.()
  }

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
        height: '100%',
        background: '#0d1117',
      }}
    >
      {/* Collapsed strip – always visible, clickable background */}
      <div
        onClick={handleStripClick}
        style={{
          width: '32px',
          height: '100%',
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'border-right': '1px solid #30363d',
          padding: '8px 0',
          cursor: 'pointer',
        }}
      >
        {props.onToggle && (
          <button
            onClick={handleButtonClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              'font-size': '14px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            {props.isCollapsed ? '▶' : '◀'}
          </button>
        )}
      </div>

      {/* Main content – visible when sidebar is wide enough */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          'flex-direction': 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '6px 10px',
            'border-bottom': '1px solid #30363d',
            'font-size': '12px',
            'font-weight': 600,
            color: '#8b949e',
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
          }}
        >
          <span>Properties</span>
          {props.onToggle && (
            <button
              onClick={handleButtonClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                'font-size': '11px',
                cursor: 'pointer',
              }}
            >
              Collapse
            </button>
          )}
        </div>

        <Show when={props.mapMode} fallback={
          <RoomInfoPanel room={props.room ?? '—'} shard={props.shard ?? null} />
        }>
          <MapInfoPanel zoom={props.mapZoom} subsActive={props.mapSubsActive} shard={props.shard} onShardChange={props.onShardChange} />
        </Show>

        <Show when={!props.mapMode && historyMode()}>
          <HistoryControlPanel />
        </Show>

        <Show
          when={props.mapMode}
          fallback={<RoomModePanel shard={props.shard} />}
        >
          <div style={{ 'padding-bottom': '8px', overflow: 'auto', 'min-height': 0 }}>
            <RoomInfoBox label="Selected" info={props.selectedRoomInfo ?? null} />
            <RoomInfoBox label="Cursor" info={props.hoveredRoomInfo ?? null} dim />
          </div>
        </Show>
      </div>
    </div>
  )
}
