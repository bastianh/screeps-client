import { For, Show, createSignal, createEffect } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Trash2, Bell, BellOff, Move, X, Flag, Eye } from 'lucide-solid'
import { selection, deselectItem } from '~/stores/selectionStore.js'
import { client, gameTime, userInfo } from '~/stores/clientStore.js'
import { setTempWatchFor } from '~/stores/memoryStore.js'
import { setShowMemory } from '~/stores/consoleStore.js'
import { overlayAction, setOverlayAction } from '~/stores/roomViewStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { roomOwner, roomUsers, currentShard, currentRoom } from '~/stores/roomDataStore.js'
import { createLogger } from '~/utils/log.js'
import { CONTROLLER_DOWNGRADE, CONTROLLER_LEVEL_TOTAL } from '~/utils/gameConstants.js'
import { ColorPicker } from '~/components/ColorPicker.js'
import type { SelectedObject } from '~/stores/selectionStore.js'

const { log, error } = createLogger('SelectionList')

// Mirror the palette from ObjectLayer so colors match
const OBJECT_COLORS: Record<string, string> = {
  creep:       '#f0883e',
  spawn:       '#58a6ff',
  extension:   '#79c0ff',
  tower:       '#3fb950',
  container:   '#8b949e',
  storage:     '#d29922',
  link:        '#a371f7',
  rampart:     '#58a6ff',
  road:        '#484f58',
  wall:        '#21262d',
  extractor:   '#8b949e',
  lab:         '#f778ba',
  terminal:    '#d29922',
  observer:    '#79c0ff',
  powerSpawn:  '#f0883e',
  nuker:       '#f85149',
  factory:     '#8b949e',
  invaderCore: '#f85149',
  source:      '#d29922',
  mineral:     '#79c0ff',
  deposit:     '#d29922',
  controller:  '#58a6ff',
  powerBank:   '#f0883e',
  portal:      '#a371f7',
  energy:      '#d29922',
}

const TYPE_LABELS: Record<string, string> = {
  creep:       'Creep',
  spawn:       'Spawn',
  extension:   'Extension',
  tower:       'Tower',
  container:   'Container',
  storage:     'Storage',
  link:        'Link',
  rampart:     'Rampart',
  road:        'Road',
  wall:        'Wall',
  extractor:   'Extractor',
  lab:         'Lab',
  terminal:    'Terminal',
  observer:    'Observer',
  powerSpawn:  'Power Spawn',
  nuker:       'Nuker',
  factory:     'Factory',
  invaderCore: 'Invader Core',
  source:      'Source',
  mineral:     'Mineral',
  deposit:     'Deposit',
  controller:  'Controller',
  powerBank:   'Power Bank',
  portal:      'Portal',
  energy:      'Energy',
  flag:        'Flag',
}

/** Fields we want to surface as key-value rows (exclude noisy / structural ones) */
const SKIP_FIELDS = new Set(['x', 'y', 'type', 'id', 'name', 'user', '_id', 'room', 'hitsMax', 'energyCapacity', 'body', 'storeCapacity', 'storeCapacityResource'])
const NUMERIC_FIELDS = new Set(['hits', 'energy', 'energyCapacity', 'store', 'progress', 'progressTotal', 'nextDecayTime'])

const FIELD_LABELS: Record<string, string> = {
  hits:                 'Hits',
  energy:               'Energy',
  progress:             'Progress',
  progressTotal:        'Progress total',
  ticksToLive:          'Ticks to live',
  ticksToRegeneration:  'Ticks to regen',
  ticksToDecay:         'Ticks to decay',
  nextDecayTime:        'Decays in',
  fatigue:              'Fatigue',
  cooldown:             'Cooldown',
  mineralType:          'Mineral type',
  mineralAmount:        'Mineral amount',
  density:              'Density',
  notifyWhenAttacked:   'Notify when attacked',
  isPublic:             'Public',
  structureType:        'Structure type',
  level:                'Level',
  power:                'Power',
  powerCapacity:        'Power capacity',
  depositType:          'Deposit type',
  lastCooldown:         'Last cooldown',
  resourceType:         'Resource type',
  amount:               'Amount',
  decay:                'Decay in',
  mode:                 'Mode',
  actionLog:            'Action log',
  store:                'Store',
}

function camelToLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

function formatValue(value: unknown): string | null {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return null
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${parseFloat(m.toFixed(2))}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return `${parseFloat(k.toFixed(1))}K`
  }
  return String(n)
}

const kvCell = (muted = false): Record<string, string> => ({
  padding: '3px 8px',
  background: '#0d1117',
  color: muted ? '#8b949e' : '#c9d1d9',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
})

const kvGrid: Record<string, string> = {
  display: 'grid',
  'grid-template-columns': '1fr 1fr',
  gap: '1px',
  background: '#21262d',
  'font-size': '10px',
}

function DefaultDetails(props: { item: SelectedObject }) {
  const fields = () => {
    const raw = props.item.raw as Record<string, unknown>
    const pairs: { key: string; label: string; value: string }[] = []
    for (const k in raw) {
      if (SKIP_FIELDS.has(k)) continue

      const v = raw[k]
      let finalValue = formatValue(v)

      if (k === 'notifyWhenAttacked' && v === false) continue
      if (k === 'off' && v === false) continue

      if (k === 'hits' && typeof raw.hitsMax === 'number') {
        finalValue = `${v} / ${raw.hitsMax}`
      }

      if (k === 'energy' && typeof raw.energyCapacity === 'number') {
        finalValue = `${v} / ${raw.energyCapacity}`
      }

      if (k === 'nextDecayTime' && typeof v === 'number') {
        const gt = gameTime()
        if (gt !== null) finalValue = String(v - gt)
      }

      if (finalValue !== null) pairs.push({ key: k, label: camelToLabel(k), value: finalValue })
    }
    pairs.sort((a, b) => {
      const aP = NUMERIC_FIELDS.has(a.key) ? 0 : 1
      const bP = NUMERIC_FIELDS.has(b.key) ? 0 : 1
      return aP - bP
    })
    return pairs
  }

  return (
    <Show when={fields().length > 0}>
      <div style={kvGrid}>
        <For each={fields()}>
          {(field) => (
            <>
              <div style={kvCell(true)}>{field.label}</div>
              <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{field.value}</div>
            </>
          )}
        </For>
      </div>
    </Show>
  )
}

function StoreDetails(props: { store?: Record<string, number>; capacity?: number | null }) {
  const items = () => {
    const storeObj = props.store || {}
    const arr: [string, number][] = []
    for (const res in storeObj) {
      arr.push([res, storeObj[res]])
    }
    return arr
  }

  const currentTotal = () => {
    const storeObj = props.store || {}
    let total = 0
    for (const res in storeObj) total += storeObj[res]
    return total
  }

  return (
    <Show when={items().length > 0}>
      <div style={{ background: '#21262d', 'border-top': '1px solid #30363d', 'font-size': '10px' }}>
        <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600, display: 'flex', 'justify-content': 'space-between' }}>
          <span>Store Contents</span>
          <Show when={props.capacity != null}>
            <span style={{ 'font-variant-numeric': 'tabular-nums', 'font-weight': 400 }}>
              {currentTotal()} / {props.capacity}
            </span>
          </Show>
        </div>
        <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '1px', background: '#21262d' }}>
          <For each={items()}>
            {([res, amount]) => (
              <>
                <div style={{ padding: '3px 8px', background: '#0d1117', color: '#8b949e' }}>
                  {res}
                </div>
                <div style={{ padding: '3px 8px', background: '#0d1117', color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
                  {amount}
                </div>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

const BODY_PART_CSS: Record<string, string> = {
  tough:         '#4c4c4c',
  move:          '#a9b7c6',
  work:          '#ffe56d',
  carry:         '#777777',
  attack:        '#f93842',
  ranged_attack: '#5d80b2',
  heal:          '#65fd62',
  claim:         '#b99cfb',
}

function CreepDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null
  const ownerName = () => {
    const uid = userId()
    if (!uid) return null
    return roomUsers()?.[uid]?.username ?? uid
  }

  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  const ttl = () => {
    const age = raw().ageTime
    const gt = gameTime()
    if (typeof age === 'number' && gt !== null) return Math.max(0, age - gt)
    return null
  }
  const fatigue = () => typeof raw().fatigue === 'number' ? (raw().fatigue as number) : null
  const store = () => raw().store as Record<string, number> | undefined
  const storeCapacity = () => typeof raw().storeCapacity === 'number' ? (raw().storeCapacity as number) : null
  const body = () => (raw().body as Array<{ type: string; hits?: number }> | undefined) ?? []

  return (
    <div>
      <div style={kvGrid}>
        <Show when={ownerName()}>
          <>
            <div style={kvCell(true)}>Owner</div>
            <div style={kvCell()}>{ownerName()}</div>
          </>
        </Show>

        <Show when={hits() !== null && hitsMax() !== null}>
          <>
            <div style={kvCell(true)}>Hits</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
          </>
        </Show>

        <Show when={ttl() !== null}>
          <>
            <div style={kvCell(true)}>Time to live</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{ttl()}</div>
          </>
        </Show>

        <Show when={fatigue() !== null}>
          <>
            <div style={kvCell(true)}>Fatigue</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums', color: fatigue()! > 0 ? '#e3b341' : undefined }}>{fatigue()}</div>
          </>
        </Show>
      </div>

      <StoreDetails store={store()} capacity={storeCapacity()} />

      <Show when={body().length > 0}>
        <div style={{ background: '#21262d', 'border-top': '1px solid #30363d', 'font-size': '10px' }}>
          <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600 }}>
            Body ({body().length})
          </div>
          <div style={{
            display: 'flex',
            'flex-wrap': 'wrap',
            gap: '3px',
            padding: '8px',
            background: '#0d1117',
          }}>
            <For each={body()}>
              {(part) => (
                <div
                  title={part.type.replace('_', ' ')}
                  style={{
                    width: '11px',
                    height: '11px',
                    'border-radius': '50%',
                    background: BODY_PART_CSS[part.type] ?? '#484f58',
                    opacity: part.hits === 0 ? 0.25 : 1,
                    'flex-shrink': 0,
                  }}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

function FlagDetails(props: { item: SelectedObject }) {
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
    c.http.game.changeFlagColor(room(), name(), primary, secondary)
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
      color: draftColor(),
      secondaryColor: draftSecondaryColor(),
    })
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
      </Show>
    </div>
  )
}

function ControllerDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const level = () => typeof raw().level === 'number' ? (raw().level as number) : 0
  const progress = () => typeof raw().progress === 'number' ? (raw().progress as number) : null
  const progressTotal = () => {
    if (typeof raw().progressTotal === 'number') return raw().progressTotal as number
    return CONTROLLER_LEVEL_TOTAL[level()] ?? null
  }
  const downgradeTime = () => typeof raw().downgradeTime === 'number' ? (raw().downgradeTime as number) : null
  const safeModeAvailable = () => typeof raw().safeModeAvailable === 'number' ? (raw().safeModeAvailable as number) : 0
  const safeMode = () => typeof raw().safeMode === 'number' ? (raw().safeMode as number) : null
  const isPowerEnabled = () => raw().isPowerEnabled === true
  const reservation = () => raw().reservation as { username: string; ticksToEnd: number } | undefined
  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null

  const ownerName = () => {
    const uid = userId()
    if (!uid) return null
    return roomOwner()?.username ?? uid
  }

  const ticksRemaining = () => {
    const dt = downgradeTime()
    const gt = gameTime()
    if (dt !== null && gt !== null) return Math.max(0, dt - gt)
    return null
  }

  const downgradeLabel = () => {
    const ticks = ticksRemaining()
    if (ticks === null) return '—'
    const max = CONTROLLER_DOWNGRADE[level()]
    if (max !== undefined && ticks >= max) return 'Max'
    return String(ticks)
  }

  const isMyRoom = () => userId() !== null && userId() === userInfo()?._id

  const [unclaimConfirming, setUnclaimConfirming] = createSignal(false)
  let unclaimTimeout: ReturnType<typeof setTimeout> | null = null

  const handleActivateSafeMode = () => {
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, raw().room as string, 'activateSafeMode', {})
      .catch((err: Error) => error('activateSafeMode failed:', err))
  }

  const handleUnclaim = () => {
    if (!unclaimConfirming()) {
      setUnclaimConfirming(true)
      unclaimTimeout = setTimeout(() => setUnclaimConfirming(false), 3000)
      return
    }
    if (unclaimTimeout) { clearTimeout(unclaimTimeout); unclaimTimeout = null }
    setUnclaimConfirming(false)
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, raw().room as string, 'unclaim', {})
      .catch((err: Error) => error('unclaim failed:', err))
  }

  return (
    <div>
      <div style={kvGrid}>
        <div style={kvCell(true)}>Owner</div>
        <div style={kvCell()}>{ownerName() ?? 'None'}</div>

        <Show when={reservation()}>
          {(res) => (
            <>
              <div style={kvCell(true)}>Reserved</div>
              <div style={kvCell()}>{res().username} ({res().ticksToEnd})</div>
            </>
          )}
        </Show>

        <Show when={level() > 0}>
          <>
            <div style={kvCell(true)}>Level</div>
            <div style={kvCell()}>{level()}</div>

            <div style={kvCell(true)}>Safe modes</div>
            <div style={kvCell()}>{safeModeAvailable()}</div>

            <div style={kvCell(true)}>Power</div>
            <div style={kvCell()}>{isPowerEnabled() ? 'Enabled' : 'Disabled'}</div>

            <div style={kvCell(true)}>Downgrade in</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums', color: downgradeLabel() === 'Max' ? '#3fb950' : undefined }}>{downgradeLabel()}</div>
          </>
        </Show>

        <Show when={safeMode() !== null}>
          <>
            <div style={kvCell(true)}>Safe mode active</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{safeMode()} ticks</div>
          </>
        </Show>
      </div>

      <Show when={level() > 0 && level() < 8 && progress() !== null && progressTotal() !== null}>
        <div style={{ padding: '5px 8px', background: '#0d1117', 'border-top': '1px solid #21262d' }}>
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '10px', 'margin-bottom': '4px' }}>
            <span style={{ color: '#8b949e' }}>RCL {level()} → {level() + 1}</span>
            <span style={{ color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
              {formatLargeNumber(progress()!)} / {formatLargeNumber(progressTotal()!)} ({((progress()! / progressTotal()!) * 100).toFixed(1)}%)
            </span>
          </div>
          <div style={{ height: '5px', background: '#21262d', 'border-radius': '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (progress()! / progressTotal()!) * 100)}%`,
              background: '#58a6ff',
              'border-radius': '3px',
            }} />
          </div>
        </div>
      </Show>

      <Show when={isMyRoom() && !historyMode()}>
        <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '6px', background: '#0d1117' }}>
          <button
            onClick={handleActivateSafeMode}
            disabled={safeModeAvailable() === 0}
            style={{
              background: safeModeAvailable() > 0 ? '#1f6feb' : '#161b22',
              color: '#fff',
              border: 'none',
              'border-radius': '4px',
              padding: '6px 8px',
              'font-size': '12px',
              cursor: safeModeAvailable() > 0 ? 'pointer' : 'not-allowed',
              opacity: safeModeAvailable() > 0 ? 1 : 0.5,
            }}
            onMouseEnter={(e) => { if (safeModeAvailable() > 0) e.currentTarget.style.background = '#388bfd' }}
            onMouseLeave={(e) => { if (safeModeAvailable() > 0) e.currentTarget.style.background = '#1f6feb' }}
          >
            Activate safe mode
          </button>
          <button
            onClick={handleUnclaim}
            style={{
              background: unclaimConfirming() ? '#da3633' : '#f85149',
              color: '#fff',
              border: 'none',
              'border-radius': '4px',
              padding: '6px 8px',
              'font-size': '12px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!unclaimConfirming()) e.currentTarget.style.background = '#da3633' }}
            onMouseLeave={(e) => { if (!unclaimConfirming()) e.currentTarget.style.background = '#f85149' }}
          >
            {unclaimConfirming() ? 'Confirm unclaim' : 'Unclaim'}
          </button>
        </div>
      </Show>
    </div>
  )
}

function ExtensionDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const energy = () => {
    const store = raw().store as Record<string, number> | undefined
    return store?.energy ?? 0
  }
  const energyCapacity = () => {
    const cap = raw().storeCapacityResource as Record<string, number> | undefined
    return cap?.energy ?? 0
  }
  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  const notifyWhenAttacked = () => raw().notifyWhenAttacked === true
  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null
  const isMyStructure = () => userId() !== null && userId() === userInfo()?._id

  const handleToggleNotify = () => {
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, raw().room as string, 'notifyWhenAttacked', { enabled: !notifyWhenAttacked() })
      .catch((err: Error) => error('notifyWhenAttacked failed:', err))
  }

  return (
    <div style={kvGrid}>
      <div style={kvCell(true)}>Energy</div>
      <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
        {energy()} / {energyCapacity()}
      </div>

      <Show when={hits() !== null && hitsMax() !== null}>
        <>
          <div style={kvCell(true)}>Hits</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
        </>
      </Show>

      <Show when={isMyStructure() && !historyMode()}>
        <>
          <div style={kvCell(true)}>Notify when attacked</div>
          <div style={{ ...kvCell(), display: 'flex', 'align-items': 'center' }}>
            <button
              onClick={handleToggleNotify}
              title={notifyWhenAttacked() ? 'Notifications on — click to disable' : 'Notifications off — click to enable'}
              style={{
                background: 'transparent',
                border: 'none',
                color: notifyWhenAttacked() ? '#3fb950' : '#484f58',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                'align-items': 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = notifyWhenAttacked() ? '#56d364' : '#8b949e' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = notifyWhenAttacked() ? '#3fb950' : '#484f58' }}
            >
              {notifyWhenAttacked() ? <Bell size={12} /> : <BellOff size={12} />}
            </button>
          </div>
        </>
      </Show>
    </div>
  )
}

function StoreStructureDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  const store = () => raw().store as Record<string, number> | undefined
  const capacity = () => {
    if (typeof raw().storeCapacity === 'number') return raw().storeCapacity as number
    const res = raw().storeCapacityResource as Record<string, number> | undefined
    if (res) {
      let total = 0
      for (const k in res) total += res[k]
      return total
    }
    return null
  }

  const total = () => {
    const s = store()
    if (!s) return 0
    let t = 0
    for (const k in s) t += s[k]
    return t
  }

  const fillPct = () => {
    const cap = capacity()
    if (!cap || cap === 0) return 0
    return Math.min(100, (total() / cap) * 100)
  }

  return (
    <div>
      <Show when={hits() !== null && hitsMax() !== null}>
        <div style={kvGrid}>
          <div style={kvCell(true)}>Hits</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
        </div>
      </Show>

      <Show when={capacity() !== null}>
        <div style={{ padding: '5px 8px', background: '#0d1117', 'border-top': '1px solid #21262d' }}>
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '10px', 'margin-bottom': '4px' }}>
            <span style={{ color: '#8b949e' }}>Fill</span>
            <span style={{ color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
              {formatLargeNumber(total())} / {formatLargeNumber(capacity()!)} ({fillPct().toFixed(1)}%)
            </span>
          </div>
          <div style={{ height: '5px', background: '#21262d', 'border-radius': '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${fillPct()}%`,
              background: '#ffe87b',
              'border-radius': '3px',
            }} />
          </div>
        </div>
      </Show>

      <StoreDetails store={store()} capacity={null} />
    </div>
  )
}

import { JSX } from 'solid-js'
const CUSTOM_DETAILS: Record<string, (props: { item: SelectedObject }) => JSX.Element> = {
  creep: CreepDetails,
  flag: FlagDetails,
  controller: ControllerDetails,
  extension: ExtensionDetails,
  storage: StoreStructureDetails,
  terminal: StoreStructureDetails,
  container: StoreStructureDetails,
  lab: StoreStructureDetails,
  factory: StoreStructureDetails,
  nuker: StoreStructureDetails,
  powerSpawn: StoreStructureDetails,
}

function SelectionItem(props: { item: SelectedObject }) {
  const color = () => OBJECT_COLORS[props.item.type] ?? '#c9d1d9'
  const label = () => TYPE_LABELS[props.item.type] ?? props.item.type
  const isCreep = () => props.item.type === 'creep'
  const isFlag = () => props.item.type === 'flag'
  const isOwnCreep = () => {
    if (!isCreep()) return false
    const raw = props.item.raw as Record<string, unknown>
    const uid = typeof raw.user === 'string' ? raw.user : null
    return uid !== null && uid === userInfo()?._id
  }
  const isOwnStructure = () => {
    if (isCreep() || isFlag() || props.item.type === 'controller') return false
    const raw = props.item.raw as Record<string, unknown>
    const uid = typeof raw.user === 'string' ? raw.user : null
    if (uid !== null) return uid === userInfo()?._id
    // Roads and walls have no user field — owned by whoever owns the room
    return roomOwner()?.userId === userInfo()?._id
  }

  const detailsComponent = () => CUSTOM_DETAILS[props.item.type] || DefaultDetails

  const [suicideConfirming, setSuicideConfirming] = createSignal(false)
  let suicideTimeout: ReturnType<typeof setTimeout> | null = null

  const [destroyConfirming, setDestroyConfirming] = createSignal(false)
  let destroyTimeout: ReturnType<typeof setTimeout> | null = null

  const [flagDeleteConfirming, setFlagDeleteConfirming] = createSignal(false)
  let flagDeleteTimeout: ReturnType<typeof setTimeout> | null = null

  const handleDeleteFlag = (e: MouseEvent) => {
    e.stopPropagation()
    if (!flagDeleteConfirming()) {
      setFlagDeleteConfirming(true)
      flagDeleteTimeout = setTimeout(() => setFlagDeleteConfirming(false), 3000)
      return
    }
    if (flagDeleteTimeout) { clearTimeout(flagDeleteTimeout); flagDeleteTimeout = null }
    setFlagDeleteConfirming(false)
    const c = client()
    if (!c) return
    const id = props.item.id
    const raw = props.item.raw as Record<string, unknown>
    c.http.game.removeFlag(raw.room as string, raw.name as string)
      .then(() => deselectItem(id))
      .catch(() => {})
  }

  const handleDestroyStructure = (e: MouseEvent) => {
    e.stopPropagation()
    if (!destroyConfirming()) {
      setDestroyConfirming(true)
      destroyTimeout = setTimeout(() => setDestroyConfirming(false), 3000)
      return
    }
    if (destroyTimeout) { clearTimeout(destroyTimeout); destroyTimeout = null }
    setDestroyConfirming(false)
    const c = client()
    if (!c) return
    const id = props.item.id
    const raw = props.item.raw as Record<string, unknown>
    const room = (typeof raw.room === 'string' ? raw.room : null) ?? currentRoom() ?? ''
    const userId = typeof raw.user === 'string' ? raw.user : (roomOwner()?.userId ?? '')
    c.http.game.addObjectIntent('room', room, 'destroyStructure', [{ id, roomName: room, user: userId }], currentShard())
      .then(() => deselectItem(id))
      .catch((err: Error) => error('destroyStructure failed:', err))
  }

  const handleSuicide = (e: MouseEvent) => {
    e.stopPropagation()
    if (!suicideConfirming()) {
      setSuicideConfirming(true)
      suicideTimeout = setTimeout(() => setSuicideConfirming(false), 3000)
      return
    }
    if (suicideTimeout) { clearTimeout(suicideTimeout); suicideTimeout = null }
    setSuicideConfirming(false)
    const c = client()
    if (!c) return
    const id = props.item.id
    c.http.game.addObjectIntent(id, props.item.raw.room as string, 'suicide', {})
      .then(() => deselectItem(id))
      .catch((err: Error) => error('suicide failed:', err))
  }

  return (
    <div
      style={{
        'border-radius': '6px',
        border: `1px solid ${(isOwnCreep() && suicideConfirming()) || destroyConfirming() || flagDeleteConfirming() ? '#f85149' : '#30363d'}`,
        'margin-bottom': '6px',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
      }}
    >
      {/* Header row */}
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
        {/* Color dot — hidden for creep and flag */}
        <Show when={!isCreep() && !isFlag()}>
          <div
            style={{
              width: '8px',
              height: '8px',
              'border-radius': '50%',
              background: color(),
              'flex-shrink': 0,
            }}
          />
        </Show>
        <span
          style={{
            'font-size': '11px',
            'font-weight': 600,
            color: '#c9d1d9',
            flex: 1,
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
            display: 'flex',
            'align-items': 'center',
            gap: '5px',
          }}
        >
          <Show when={isFlag()} fallback={<>{label()}</>}>
            <Flag size={12} />
          </Show>
          <Show when={typeof props.item.raw.name === 'string' && props.item.raw.name}>
            {(name) => (
              <span style={{ 'font-weight': 400, color: '#8b949e' }}>
                {name() as string}
              </span>
            )}
          </Show>
        </span>
        <span style={{ 'font-size': '10px', color: '#484f58', 'flex-shrink': 0, 'margin-right': '2px' }}>
          ({props.item.raw.x},{props.item.raw.y})
        </span>
        <Show when={isOwnCreep() && !historyMode()}>
          <button
            onClick={handleSuicide}
            title={suicideConfirming() ? 'Click again to confirm suicide' : 'Suicide'}
            style={{
              background: 'transparent',
              border: 'none',
              color: suicideConfirming() ? '#f85149' : '#8b949e',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'flex-shrink': 0,
            }}
            onMouseEnter={(e) => { if (!suicideConfirming()) e.currentTarget.style.color = '#f85149' }}
            onMouseLeave={(e) => { if (!suicideConfirming()) e.currentTarget.style.color = '#8b949e' }}
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => {
              setTempWatchFor(props.item.id, props.item.raw.name as string)
              setShowMemory(true)
            }}
            title="Watch memory"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'flex-shrink': 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#58a6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}
          >
            <Eye size={13} />
          </button>
        </Show>
        <Show when={isOwnStructure() && !historyMode()}>
          <button
            onClick={handleDestroyStructure}
            title={destroyConfirming() ? 'Click again to confirm destruction' : 'Destroy structure'}
            style={{
              background: 'transparent',
              border: 'none',
              color: destroyConfirming() ? '#f85149' : '#8b949e',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'flex-shrink': 0,
            }}
            onMouseEnter={(e) => { if (!destroyConfirming()) e.currentTarget.style.color = '#f85149' }}
            onMouseLeave={(e) => { if (!destroyConfirming()) e.currentTarget.style.color = '#8b949e' }}
          >
            <Trash2 size={13} />
          </button>
        </Show>
        <Show when={isFlag() && !historyMode()}>
          <button
            onClick={handleDeleteFlag}
            title={flagDeleteConfirming() ? 'Click again to confirm deletion' : 'Delete flag'}
            style={{
              background: 'transparent',
              border: 'none',
              color: flagDeleteConfirming() ? '#f85149' : '#8b949e',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'flex-shrink': 0,
            }}
            onMouseEnter={(e) => { if (!flagDeleteConfirming()) e.currentTarget.style.color = '#f85149' }}
            onMouseLeave={(e) => { if (!flagDeleteConfirming()) e.currentTarget.style.color = '#8b949e' }}
          >
            <Trash2 size={13} />
          </button>
        </Show>
        <button
          onClick={() => deselectItem(props.item.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            padding: '0 4px',
            'font-size': '14px',
            'line-height': '1',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center'
          }}
          title="Deselect"
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}
        >
          ×
        </button>
      </div>

      <Dynamic component={detailsComponent()} item={props.item} />

      {/* ID row — shown for every object that has one */}
      <Show when={props.item.id}>
        {(id) => (
          <div
            style={{
              padding: '3px 8px',
              'border-top': '1px solid #21262d',
              'font-size': '9px',
              color: '#484f58',
              'font-family': 'monospace',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap',
              cursor: 'pointer',
            }}
            title={id()}
            onClick={() => navigator.clipboard?.writeText(id())}
          >
            {id()}
          </div>
        )}
      </Show>
    </div>
  )
}

export function SelectionList() {
  return (
    <div style={{ flex: 1, overflow: 'auto', 'min-height': 0, padding: '8px' }}>
      <Show
        when={selection().length > 0}
        fallback={
          <div style={{ color: '#484f58', 'font-style': 'italic', 'font-size': '12px' }}>
            Click a tile to select objects…
          </div>
        }
      >
        <For each={selection()}>
          {(item) => <SelectionItem item={item} />}
        </For>
      </Show>
    </div>
  )
}
