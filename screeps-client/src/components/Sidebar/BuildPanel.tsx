import { For, Show, createSignal, createEffect, on, onCleanup } from 'solid-js'
import { buildDraft, setBuildDraft, CONTROLLER_STRUCTURES } from '~/stores/roomViewStore.js'
import { worldStatus, client } from '~/stores/clientStore.js'
import { controllerLevel, structureCounts } from '~/stores/roomDataStore.js'

interface BuildPanelProps {
  shard?: string | null
}

type NameStatus = 'idle' | 'loading' | 'valid' | 'invalid'

export function BuildPanel(props: BuildPanelProps) {
  const structureTypes = Object.keys(CONTROLLER_STRUCTURES)

  const [nameStatus, setNameStatus] = createSignal<NameStatus>('idle')
  const [nameError, setNameError] = createSignal('')
  let validateTimeout: ReturnType<typeof setTimeout> | null = null

  const getMaxForLevel = (type: string, rcl: number): number => {
    const levels = CONTROLLER_STRUCTURES[type]
    if (!levels) return 0
    if (worldStatus() === 'empty' && type === 'spawn') {
      return Math.max(levels[rcl] ?? 0, 1)
    }
    return levels[rcl] ?? 0
  }

  const getRemaining = (type: string, rcl: number): number => {
    const max = getMaxForLevel(type, rcl)
    if (max === 2500) return Infinity
    const current = structureCounts()[type] ?? 0
    return Math.max(0, max - current)
  }

  const isSpawnSelected = () => buildDraft().structureType === 'spawn'

  // Fetch a suggested name only when structureType switches to 'spawn'
  createEffect(on(
    () => buildDraft().structureType,
    (type, prevType) => {
      if (type !== 'spawn' || type === prevType) return
      const c = client()
      if (!c) return
      setNameStatus('loading')
      setNameError('')
      let stale = false
      onCleanup(() => { stale = true })
      c.http.game.genUniqueObjectName('spawn', props.shard)
        .then((res) => {
          if (stale) return
          setBuildDraft({ structureType: 'spawn', structureName: res.name })
          setNameStatus('valid')
        })
        .catch(() => {
          if (stale) return
          setBuildDraft({ structureType: 'spawn', structureName: 'Spawn1' })
          setNameStatus('idle')
        })
    }
  ))

  const validateName = (name: string) => {
    if (validateTimeout) clearTimeout(validateTimeout)
    if (!name.trim()) {
      setNameStatus('invalid')
      setNameError('Name cannot be empty')
      return
    }
    setNameStatus('loading')
    setNameError('')
    validateTimeout = setTimeout(() => {
      const c = client()
      if (!c) return
      c.http.game.checkUniqueObjectName('spawn', name.trim(), props.shard)
        .then((res) => {
          if (res.error) {
            setNameStatus('invalid')
            setNameError(res.error)
          } else {
            setNameStatus('valid')
            setNameError('')
          }
        })
        .catch(() => {
          setNameStatus('invalid')
          setNameError('Could not validate name')
        })
    }, 400)
  }

  const handleNameInput = (value: string) => {
    setBuildDraft({ structureType: 'spawn', structureName: value })
    validateName(value)
  }

  const handleSelectType = (type: string) => {
    setBuildDraft({ structureType: type, structureName: '' })
    setNameStatus('idle')
    setNameError('')
  }

  const statusIcon = () => {
    switch (nameStatus()) {
      case 'loading': return <span style={{ color: '#8b949e' }}>…</span>
      case 'valid':   return <span style={{ color: '#3fb950' }}>✓</span>
      case 'invalid': return <span style={{ color: '#f85149' }}>✗</span>
      default:        return null
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', 'min-height': 0, padding: '8px' }}>
      <div
        style={{
          'border-radius': '6px',
          border: '1px solid #30363d',
          overflow: 'hidden',
          background: '#0d1117',
          'margin-bottom': '8px',
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
          Controller Level {controllerLevel() ?? '?'}
        </div>
        <div style={{ padding: '8px', 'font-size': '11px', color: '#8b949e' }}>
          {(() => {
            const status = worldStatus()
            if (status === 'empty') return 'World is empty — place a spawn to claim this room.'
            if (status === 'lost') return 'You lost all your spawns — respawn to continue.'
            return controllerLevel() != null
              ? `RCL ${controllerLevel()} — Select a structure type and click a tile to build.`
              : 'No controller — roads and containers only.'
          })()}
        </div>
      </div>

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
          Structures
        </div>
        <For each={structureTypes}>
          {(type) => {
            const rcl = () => controllerLevel() ?? 0
            const max = () => getMaxForLevel(type, rcl())
            const current = () => structureCounts()[type] ?? 0
            const isSelected = () => buildDraft().structureType === type
            const isUnlimited = () => max() === 2500
            const isMaxed = () => !isUnlimited() && getRemaining(type, rcl()) <= 0

            return (
              <Show when={max() > 0}>
                <div
                  onClick={() => !isMaxed() && handleSelectType(type)}
                  style={{
                    padding: '6px 8px',
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    'border-bottom': '1px solid #21262d',
                    background: isSelected() ? '#1f3158' : 'transparent',
                    cursor: isMaxed() ? 'default' : 'pointer',
                    opacity: isMaxed() ? 0.5 : 1,
                    'font-size': '11px',
                    color: '#c9d1d9',
                  }}
                >
                  <span style={{ 'text-transform': 'capitalize' }}>
                    {type.replace(/([A-Z])/g, ' $1').trim()}
                    {isSelected() && ' ✓'}
                  </span>
                  <span style={{ color: '#8b949e' }}>
                    {isUnlimited()
                      ? `${current()}/∞`
                      : `${current()}/${max()}`}
                    {isMaxed() && ' (Max)'}
                  </span>
                </div>
              </Show>
            )
          }}
        </For>
      </div>

      {/* Spawn name input — shown whenever spawn is selected */}
      <Show when={isSpawnSelected()}>
        <div
          style={{
            'margin-top': '8px',
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
            Spawn name
          </div>
          <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
              <input
                type="text"
                value={buildDraft().structureName ?? ''}
                onInput={(e) => handleNameInput(e.currentTarget.value)}
                style={{
                  flex: 1,
                  background: '#010409',
                  color: '#c9d1d9',
                  border: `1px solid ${nameStatus() === 'invalid' ? '#f85149' : nameStatus() === 'valid' ? '#238636' : '#30363d'}`,
                  'border-radius': '4px',
                  padding: '5px 7px',
                  'font-size': '12px',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
              />
              <span style={{ 'font-size': '14px', 'flex-shrink': 0, width: '14px', 'text-align': 'center' }}>
                {statusIcon()}
              </span>
            </div>
            <Show when={nameStatus() === 'invalid' && nameError()}>
              <div style={{ 'font-size': '10px', color: '#f85149' }}>{nameError()}</div>
            </Show>
          </div>
        </div>
      </Show>

      <div style={{ 'margin-top': '8px', padding: '0 4px' }}>
        <div style={{ color: '#484f58', 'font-style': 'italic', 'font-size': '12px' }}>
          {buildDraft().structureType
            ? 'Click a tile in the room to build.'
            : 'Select a structure type, then click a tile.'}
        </div>
      </div>
    </div>
  )
}
