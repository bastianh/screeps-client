import { For, Show } from 'solid-js'
import {
  historyMode, historyTick, historyMaxTick, isPlaying, playbackSpeed,
  historyLoading, enterHistoryMode, exitHistoryMode,
  stepTick, togglePlayback, setPlaybackSpeedValue,
} from '~/stores/historyStore.js'
import { gameTime, tickDuration } from '~/stores/clientStore.js'

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20] as const

const STEP_BUTTONS_LEFT = [
  { delta: -100, label: '-100' },
  { delta: -10, label: '-10' },
] as const

const STEP_BUTTONS_RIGHT = [
  { delta: 10, label: '+10' },
  { delta: 100, label: '+100' },
] as const

function stepBtnStyle(disabled: boolean): Record<string, string> {
  return {
    flex: '1',
    padding: '4px',
    'border-radius': '4px',
    border: '1px solid #30363d',
    background: '#161b22',
    color: disabled ? '#484f58' : '#8b949e',
    cursor: disabled ? 'not-allowed' : 'pointer',
    'font-size': '11px',
  }
}

export function HistoryControlPanel() {
  const estimatedDate = () => {
    const max = historyMaxTick()
    const current = historyTick()
    const avgMs = tickDuration() ?? 3000
    const deltaMs = (max - current) * avgMs
    return new Date(Date.now() - deltaMs).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const handleToggle = () => {
    if (historyMode()) {
      exitHistoryMode()
    } else {
      const t = gameTime()
      if (t !== null) enterHistoryMode(t)
    }
  }

  return (
    <div style={{ padding: '8px', 'border-bottom': '1px solid #30363d', 'flex-shrink': 0 }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!historyMode() && gameTime() === null}
        style={{
          width: '100%',
          padding: '5px 8px',
          'border-radius': '6px',
          border: `1px solid ${historyMode() ? '#58a6ff' : '#30363d'}`,
          background: historyMode() ? '#1f6feb33' : '#161b22',
          color: historyMode() ? '#c9d1d9' : '#8b949e',
          cursor: 'pointer',
          'font-size': '11px',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '4px',
        }}
      >
        {historyMode() ? '⏺ History (active)' : '⏺ History'}
      </button>

      <Show when={historyMode()}>
        <div style={{ 'margin-top': '8px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
          <div style={{ 'font-size': '11px' }}>
            <div style={{ color: historyLoading() ? '#f0883e' : '#c9d1d9' }}>
              {historyLoading() ? 'Loading…' : `Tick ${historyTick()}`}
            </div>
            <div style={{ 'font-size': '10px', color: '#484f58', 'margin-top': '2px' }}>
              ~{estimatedDate()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '3px' }}>
            <For each={STEP_BUTTONS_LEFT}>
              {(item) => (
                <button
                  type="button"
                  onClick={() => stepTick(item.delta)}
                  disabled={historyLoading()}
                  style={stepBtnStyle(historyLoading())}
                >
                  {item.label}
                </button>
              )}
            </For>
            <button
              type="button"
              onClick={togglePlayback}
              disabled={historyLoading()}
              style={{
                flex: '1.5',
                padding: '4px',
                'border-radius': '4px',
                border: '1px solid #30363d',
                background: isPlaying() ? '#1a3a2a' : '#161b22',
                color: isPlaying() ? '#3fb950' : '#8b949e',
                cursor: historyLoading() ? 'not-allowed' : 'pointer',
                'font-size': '11px',
              }}
            >
              {isPlaying() ? '⏸' : '▶'}
            </button>
            <For each={STEP_BUTTONS_RIGHT}>
              {(item) => (
                <button
                  type="button"
                  onClick={() => stepTick(item.delta)}
                  disabled={historyLoading()}
                  style={stepBtnStyle(historyLoading())}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>

          <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
            <span style={{ 'font-size': '10px', color: '#8b949e', 'white-space': 'nowrap' }}>Speed</span>
            <select
              value={playbackSpeed()}
              onChange={(e) => setPlaybackSpeedValue(parseFloat(e.currentTarget.value))}
              style={{
                flex: '1',
                background: '#161b22',
                color: '#8b949e',
                border: '1px solid #30363d',
                'border-radius': '4px',
                padding: '3px 6px',
                'font-size': '11px',
                cursor: 'pointer',
              }}
            >
              <For each={SPEED_OPTIONS}>
                {(s) => <option value={s}>{s}/s</option>}
              </For>
            </select>
          </div>
        </div>
      </Show>
    </div>
  )
}
