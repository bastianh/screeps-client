import { Show, createSignal, createEffect } from 'solid-js'
import { Move, X } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { overlayAction, setOverlayAction, type MoveFlagAction } from '~/stores/roomViewStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { currentShard, currentRoom } from '~/stores/roomDataStore.js'
import { createLogger } from '~/utils/log.js'
import { ColorPicker } from '~/components/ColorPicker.js'
import type { SelectedObject } from '~/stores/selectionStore.js'

const { log, error } = createLogger('SelectionList')

export function FlagDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>
  const name = () => (typeof raw().name === 'string' ? (raw().name as string) : '')
  const room = () => (typeof raw().room === 'string' ? (raw().room as string) : '')
  const currentColor = () => (typeof raw().color === 'number' ? (raw().color as number) : 1)
  const currentSecondaryColor = () =>
    typeof raw().secondaryColor === 'number' ? (raw().secondaryColor as number) : 1

  const [draftColor, setDraftColor] = createSignal(currentColor())
  const [draftSecondaryColor, setDraftSecondaryColor] = createSignal(currentSecondaryColor())

  createEffect(() => {
    setDraftColor(currentColor())
    setDraftSecondaryColor(currentSecondaryColor())
  })

  const hasChanges = () =>
    draftColor() !== currentColor() || draftSecondaryColor() !== currentSecondaryColor()

  const handleApply = () => {
    const c = client()
    if (!c) return
    const primary = draftColor()
    const secondary = draftSecondaryColor()
    log(`changeFlagColor: name="${name()}" room=${room()} primary=${primary} secondary=${secondary}`)
    c.http.game.changeFlagColor(room(), name(), primary, secondary, currentShard() ?? undefined)
      .then(() => log('changeFlagColor OK'))
      .catch((err: Error) => error('changeFlagColor FAILED:', err))
  }

  const isMovingThisFlag = () => {
    const oa = overlayAction()
    return oa?.type === 'moveFlag' && oa.id === props.item.id
  }

  const handleMoveToggle = () => {
    if (isMovingThisFlag()) {
      setOverlayAction(null)
      return
    }
    setOverlayAction({
      type: 'moveFlag',
      id: props.item.id,
      name: name(),
      room: room(),
      x: props.item.raw.x,
      y: props.item.raw.y,
      color: draftColor(),
      secondaryColor: draftSecondaryColor(),
      targetRoom: currentRoom() ?? room(),
    })
  }

  const moveFlagOverlay = (): MoveFlagAction | null => {
    const oa = overlayAction()
    return oa?.type === 'moveFlag' && oa.id === props.item.id ? oa : null
  }

  const labelStyle = {
    display: 'flex',
    'flex-direction': 'column',
    gap: '5px',
    'font-size': '11px',
    color: '#8b949e',
  } as const

  return (
    <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '8px', background: '#0d1117' }}>
      <label style={labelStyle}>
        Primary color
        <ColorPicker value={draftColor()} onChange={setDraftColor} />
      </label>

      <label style={labelStyle}>
        Secondary color
        <ColorPicker value={draftSecondaryColor()} onChange={setDraftSecondaryColor} />
      </label>

      <Show when={!historyMode()}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleApply}
          disabled={!hasChanges()}
          style={{
            flex: 1,
            background: hasChanges() ? '#238636' : '#161b22',
            color: hasChanges() ? '#fff' : '#484f58',
            border: `1px solid ${hasChanges() ? '#238636' : '#30363d'}`,
            'border-radius': '4px',
            padding: '5px 8px',
            'font-size': '11px',
            cursor: hasChanges() ? 'pointer' : 'not-allowed',
            transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
          }}
          onMouseEnter={(e) => { if (hasChanges()) e.currentTarget.style.background = '#2ea043' }}
          onMouseLeave={(e) => { if (hasChanges()) e.currentTarget.style.background = '#238636' }}
        >
          Apply color
        </button>

        <button
          onClick={handleMoveToggle}
          title={isMovingThisFlag() ? 'Abort move' : 'Move flag'}
          style={{
            background: isMovingThisFlag() ? '#30363d' : '#21262d',
            color: isMovingThisFlag() ? '#c9d1d9' : '#8b949e',
            border: `1px solid ${isMovingThisFlag() ? '#8b949e' : '#30363d'}`,
            'border-radius': '4px',
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#c9d1d9' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = isMovingThisFlag() ? '#c9d1d9' : '#8b949e' }}
        >
          {isMovingThisFlag() ? <X size={13} /> : <Move size={13} />}
        </button>
      </div>
      <Show when={moveFlagOverlay()}>
        {(oa) => (
          <label style={labelStyle}>
            Target room
            <input
              value={oa().targetRoom}
              onInput={(e) => setOverlayAction({ ...oa(), targetRoom: e.currentTarget.value.toUpperCase() })}
              style={{
                background: '#010409',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                'border-radius': '4px',
                padding: '5px 6px',
                'font-size': '12px',
                outline: 'none',
              }}
            />
            <span style={{ 'font-size': '10px', color: '#484f58' }}>
              Navigate to target room, then click a tile
            </span>
          </label>
        )}
      </Show>
      </Show>
    </div>
  )
}
