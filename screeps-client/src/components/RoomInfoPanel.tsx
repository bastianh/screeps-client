import { For, Show, type JSX } from 'solid-js'
import { Eye, Flag, Hammer, Clock } from 'lucide-solid'
import { gameTime, tickDuration, isGuest } from '~/stores/clientStore.js'
import { roomObjectCount, roomOwner, controllerLevel, controllerProgress } from '~/stores/roomDataStore.js'
import { roomViewMode, setRoomViewMode, type RoomViewMode } from '~/stores/roomViewStore.js'
import { historyMode, enterHistoryMode, exitHistoryMode } from '~/stores/historyStore.js'
import { showCreepLabels, setShowCreepLabels, showRoomVisuals, setShowRoomVisuals } from '~/stores/settingsStore.js'
import { CONTROLLER_LEVEL_TOTAL } from '~/utils/gameConstants.js'

interface RoomInfoPanelProps {
  room: string
  shard: string | null
}

const ROOM_VIEW_MODES: Array<{ mode: RoomViewMode; label: string; icon: () => JSX.Element }> = [
  { mode: 'view', label: 'View',  icon: () => <Eye size={14} /> },
  { mode: 'flag', label: 'Flag',  icon: () => <Flag size={14} /> },
  { mode: 'build', label: 'Build', icon: () => <Hammer size={14} /> },
]

export function RoomInfoPanel(props: RoomInfoPanelProps) {
  return (<div style={{ padding: '8px', 'border-bottom': '1px solid #30363d', 'flex-shrink': 0 }}>
    <div style={{
      padding: '4px 8px', background: '#161b22', 'border-radius': '6px', border: '1px solid #30363d',
    }}>
      <div style={{
        'font-size': '10px',
        'font-weight': 600,
        color: '#8b949e',
        'text-transform': 'uppercase',
        'letter-spacing': '0.04em',
        'margin-bottom': '4px',
      }}> Room
      </div>
      <div style={{ 'font-size': '13px', 'font-weight': 600, color: '#c9d1d9' }}>
        {props.room}
      </div>
      <div style={{
        display: 'grid',
        'grid-template-columns': 'auto 1fr',
        'row-gap': '1px',
        'margin-top': '4px',
        'font-size': '11px',
      }}>
        <div style={{ padding: '3px 0', color: '#8b949e' }}>Shard</div>
        <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{props.shard ?? '—'}</div>
        <div style={{ padding: '3px 0', color: '#8b949e' }}>Tick</div>
        <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{gameTime() ?? '—'}</div>
        <div style={{ padding: '3px 0', color: '#8b949e' }}>Tick duration</div>
        <div style={{ padding: '3px 0', color: '#c9d1d9' }}>
          {tickDuration() ? `${tickDuration()}ms` : '—'}
        </div>
        <div style={{ padding: '3px 0', color: '#8b949e' }}>Objects</div>
        <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{roomObjectCount() ?? '—'}</div>
        <div style={{ padding: '3px 0', color: '#8b949e' }}>Owner</div>
        <div style={{ padding: '3px 0', color: '#c9d1d9' }}>{roomOwner()?.username ?? '—'}</div>
        <Show when={controllerLevel() !== null && controllerLevel()! > 0}>
          <div style={{ padding: '3px 0', color: '#8b949e' }}>RCL</div>
          <div style={{ padding: '3px 0', color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
            <Show
              when={controllerLevel()! < 8 && controllerProgress() !== null}
              fallback={<span>{controllerLevel()}</span>}
            >
              {controllerLevel()} → {controllerLevel()! + 1}&nbsp;
              <span style={{ color: '#8b949e' }}>
                ({((controllerProgress()! / (CONTROLLER_LEVEL_TOTAL[controllerLevel()!] ?? 1)) * 100).toFixed(1)}%)
              </span>
            </Show>
          </div>
        </Show>
      </div>
      <label
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          'font-size': '11px',
          color: '#c9d1d9',
          cursor: 'pointer',
          'margin-top': '6px',
        }}
      >
        <span>Creep-Namen</span>
        <input
          type="checkbox"
          checked={showCreepLabels()}
          onChange={(e) => setShowCreepLabels(e.currentTarget.checked)}
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
        <span>Room Visuals</span>
        <input
          type="checkbox"
          checked={showRoomVisuals()}
          onChange={(e) => setShowRoomVisuals(e.currentTarget.checked)}
        />
      </label>
    </div>
    <div
      style={{
        display: 'grid',
        'grid-template-columns': `repeat(${isGuest() ? 2 : 4}, 1fr)`,
        gap: '4px',
        'margin-top': '8px',
      }}
    >
      <Show when={!isGuest()}>
        <For each={ROOM_VIEW_MODES}>
          {(entry) => {
            const active = () => !historyMode() && roomViewMode() === entry.mode
            return (
              <button
                type="button"
                onClick={() => { if (historyMode()) exitHistoryMode(); setRoomViewMode(entry.mode) }}
                title={entry.label}
                style={{
                  padding: '5px 8px',
                  'border-radius': '6px',
                  border: `1px solid ${active() ? '#58a6ff' : '#30363d'}`,
                  background: active() ? '#1f6feb33' : '#161b22',
                  color: active() ? '#c9d1d9' : '#8b949e',
                  cursor: 'pointer',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                }}
              >
                {entry.icon()}
              </button>
            )
          }}
        </For>
      </Show>
      <button
        type="button"
        onClick={() => historyMode() ? exitHistoryMode() : gameTime() !== null && enterHistoryMode(gameTime()!)}
        disabled={!historyMode() && gameTime() === null}
        title="History"
        style={{
          'grid-column': isGuest() ? 'span 2' : undefined,
          padding: '5px 8px',
          'border-radius': '6px',
          border: `1px solid ${historyMode() ? '#58a6ff' : '#30363d'}`,
          background: historyMode() ? '#1f6feb33' : '#161b22',
          color: historyMode() ? '#c9d1d9' : '#8b949e',
          cursor: (!historyMode() && gameTime() === null) ? 'not-allowed' : 'pointer',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          opacity: (!historyMode() && gameTime() === null) ? 0.4 : 1,
        }}
      >
        <Clock size={14} />
      </button>
    </div>
  </div>)
}
