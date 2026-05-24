import { For, Show, createEffect, createSignal } from 'solid-js'
import { flagDraft, roomViewMode, setFlagDraft, pendingTile, FLAG_COLOR_MAP } from '~/stores/roomViewStore.js'
import { client, userFlags } from '~/stores/clientStore.js'
import { FLAG_COLORS as FLAG_COLOR_HEXES } from '~/renderer/colors.js'
import { ColorPicker } from '~/components/ColorPicker.js'
import { createLogger } from '~/utils/log.js'

const { error } = createLogger('flag')

// Reverse map: numeric value → COLOR_NAME string
const COLOR_NUM_TO_NAME: Record<number, string> = {}
for (const [name, num] of Object.entries(FLAG_COLOR_MAP)) {
  COLOR_NUM_TO_NAME[num] = name
}

export function FlagForm() {
  const updateDraft = (patch: Partial<ReturnType<typeof flagDraft>>) => {
    setFlagDraft({ ...flagDraft(), ...patch })
  }

  const [nameError, setNameError] = createSignal<string | null>(null)
  const [isChecking, setIsChecking] = createSignal(false)
  let checkTimeout: ReturnType<typeof setTimeout> | null = null

  // Auto-generate a unique flag name when entering flag mode with an empty name
  createEffect(() => {
    if (roomViewMode() !== 'flag') return
    if (flagDraft().name.trim() !== '') return

    const c = client()
    if (!c) return

    c.http.game.genUniqueFlagName()
      .then((res) => {
        updateDraft({ name: res.name })
        setNameError(null)
      })
      .catch((err) => {
        error('gen unique name failed:', err)
      })
  })

  const handleNameInput = (value: string) => {
    updateDraft({ name: value })
    setNameError(null)

    if (checkTimeout) clearTimeout(checkTimeout)

    const trimmed = value.trim()
    if (!trimmed) {
      setIsChecking(false)
      return
    }

    setIsChecking(true)
    checkTimeout = setTimeout(() => {
      const c = client()
      if (!c) { setIsChecking(false); return }
      c.http.game.checkUniqueFlagName(trimmed)
        .then(() => { setNameError(null) })
        .catch((err: Error) => { setNameError(err.message) })
        .finally(() => { setIsChecking(false) })
    }, 300)
  }

  const primaryColorNum = () => FLAG_COLOR_MAP[flagDraft().color] ?? 1
  const secondaryColorNum = () => FLAG_COLOR_MAP[flagDraft().secondaryColor] ?? 1

  const handlePrimaryChange = (num: number) => {
    updateDraft({ color: COLOR_NUM_TO_NAME[num] ?? 'COLOR_WHITE' })
  }
  const handleSecondaryChange = (num: number) => {
    updateDraft({ secondaryColor: COLOR_NUM_TO_NAME[num] ?? 'COLOR_WHITE' })
  }

  const flags = () => {
    const f = userFlags()
    const arr: [string, { room: string; x: number; y: number; color?: number; secondaryColor?: number }][] = []
    for (const [name, data] of Object.entries(f)) {
      if (data && typeof data === 'object' && 'room' in data && 'x' in data && 'y' in data) {
        arr.push([name, data as { room: string; x: number; y: number; color?: number; secondaryColor?: number }])
      }
    }
    return arr
  }

  const flagColorCss = (colorNum?: number) => {
    if (colorNum === undefined || colorNum < 0 || colorNum >= FLAG_COLOR_HEXES.length) return '#8b949e'
    const hex = FLAG_COLOR_HEXES[colorNum]
    return `#${hex.toString(16).padStart(6, '0')}`
  }

  const labelStyle = {
    display: 'flex',
    'flex-direction': 'column',
    gap: '5px',
    'font-size': '11px',
    color: '#8b949e',
  } as const

  return (
    <div style={{ flex: 1, overflow: 'auto', 'min-height': 0, padding: '8px' }}>
      <div
        style={{
          'border-radius': '6px',
          border: '1px solid #30363d',
          overflow: 'hidden',
          background: '#0d1117',
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            background: '#161b22',
            'border-bottom': '1px solid #21262d',
            'font-size': '11px',
            'font-weight': 600,
            color: '#c9d1d9',
          }}
        >
          Create flag
        </div>
        <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <label style={labelStyle}>
            Name
            <input
              value={flagDraft().name}
              onInput={(e) => handleNameInput(e.currentTarget.value)}
              placeholder="Flag name"
              style={{
                background: '#010409',
                color: '#c9d1d9',
                border: `1px solid ${nameError() ? '#f85149' : '#30363d'}`,
                'border-radius': '4px',
                padding: '5px 6px',
                'font-size': '12px',
                outline: 'none',
              }}
            />
            <Show when={nameError()}>
              {(err) => <span style={{ color: '#f85149', 'font-size': '11px' }}>{err()}</span>}
            </Show>
            <Show when={isChecking()}>
              <span style={{ color: '#8b949e', 'font-size': '11px' }}>Checking…</span>
            </Show>
          </label>

          <label style={labelStyle}>
            Primary color
            <ColorPicker value={primaryColorNum()} onChange={handlePrimaryChange} />
          </label>

          <label style={labelStyle}>
            Secondary color
            <ColorPicker value={secondaryColorNum()} onChange={handleSecondaryChange} />
          </label>

          <div style={{ color: '#484f58', 'font-size': '11px', 'line-height': '1.4' }}>
            {pendingTile()
              ? `Marked at x=${pendingTile()!.tx}, y=${pendingTile()!.ty}. Click again to create the flag, or click elsewhere to move the mark.`
              : 'Click a position in the room to mark it.'}
          </div>
        </div>
      </div>

      <Show when={flags().length > 0} fallback={
        <div style={{ 'margin-top': '8px', color: '#484f58', 'font-style': 'italic', 'font-size': '12px' }}>
          No flags.
        </div>
      }>
        <div style={{ 'margin-top': '8px' }}>
          <div
            style={{
              padding: '6px 8px',
              'font-size': '11px',
              'font-weight': 600,
              color: '#c9d1d9',
              'margin-bottom': '6px',
            }}
          >
            Your flags
          </div>
          <For each={flags()}>
            {([name, flag]) => (
              <div
                style={{
                  'border-radius': '6px',
                  border: '1px solid #30363d',
                  'margin-bottom': '6px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '7px',
                    padding: '6px 8px',
                    background: '#161b22',
                    'border-bottom': '1px solid #21262d',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      'border-radius': '50%',
                      background: flagColorCss(flag.color),
                      'flex-shrink': 0,
                    }}
                  />
                  <span
                    style={{
                      'font-size': '11px',
                      'font-weight': 600,
                      color: '#c9d1d9',
                      flex: 1,
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ 'font-size': '10px', color: '#8b949e', 'flex-shrink': 0 }}>
                    {flag.room}
                  </span>
                  <span style={{ 'font-size': '10px', color: '#484f58', 'flex-shrink': 0, 'margin-left': '4px' }}>
                    ({flag.x},{flag.y})
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

