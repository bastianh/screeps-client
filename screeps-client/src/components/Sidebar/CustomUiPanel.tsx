import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js'
import { createStore } from 'solid-js/store'
import { RefreshCw } from 'lucide-solid'
import {
  uiConfig, uiError, uiLoading, uiSegment, loadCustomUi, dispatchCustomUi, pendingIds, roomViewStanding,
  type CustomUiElement, type CustomUiContext, type CustomUiNeed, type CustomUiRoomStanding,
} from '~/stores/customUiStore.js'
import { selection } from '~/stores/selectionStore.js'
import { pendingTile } from '~/stores/roomViewStore.js'
import { client, isGuest, userInfo } from '~/stores/clientStore.js'
import type { RoomInfo } from '~/components/MapViewer.js'

interface CustomUiPanelProps {
  mode: 'map' | 'room'
  shard: string | null
  /** Current room (room mode). */
  room?: string
  /** Selected room on the world map (map mode). */
  selectedRoomInfo?: RoomInfo | null
}

const NEED_LABELS: Record<CustomUiNeed, string> = {
  room: 'a selected room',
  selection: 'selected objects',
  tile: 'a marked tile',
}

interface TreeEntry {
  el: CustomUiElement
  /** Child of a header — rendered indented. */
  child: boolean
  /** Stable per-config-position key, independent of filtering. */
  key: string
}

function formatStatusValue(value: unknown): string {
  if (value === undefined) return '—'
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
  return text.length > 40 ? `${text.slice(0, 39)}…` : text
}

// Sidebar panel rendering the player-defined elements for the current view.
// Hidden entirely unless a config segment is set and yields elements or an error.
export function CustomUiPanel(props: CustomUiPanelProps) {
  // Key of the element awaiting its confirmation click, reset after 3s
  const [confirming, setConfirming] = createSignal<string | null>(null)
  // Chosen option per select element, keyed by element key
  const [selectValues, setSelectValues] = createStore<Record<string, string>>({})
  // Live memory values for status elements, keyed by path
  const [statusValues, setStatusValues] = createStore<Record<string, unknown>>({})
  // Dispatch id per element key; the element renders busy while its id is pending
  const [inflight, setInflight] = createStore<Record<string, string>>({})
  let confirmTimer: number | undefined
  onCleanup(() => window.clearTimeout(confirmTimer))

  const allElements = () => {
    const cfg = uiConfig()
    if (!cfg) return []
    return props.mode === 'map' ? cfg.map : cfg.room
  }

  // The viewer's relation to the relevant room: the selected one on the map,
  // the visited one in room view. Null when no map room is selected.
  const roomStanding = (): CustomUiRoomStanding | null => {
    if (props.mode === 'room') return roomViewStanding()
    const info = props.selectedRoomInfo
    if (!info) return null
    const me = userInfo()
    if (info.owner) return info.owner === me?.username ? 'own' : 'foreign'
    if (info.reservation) return info.reservation === me?.username ? 'reserved' : 'foreign'
    return 'empty'
  }

  const isVisible = (el: CustomUiElement): boolean => {
    const selType = el.showIf?.selType
    if (selType !== undefined && !(props.mode === 'room' && selection().some((s) => s.type === selType))) {
      return false
    }
    const room = el.showIf?.room
    if (room !== undefined) {
      const standing = roomStanding()
      if (standing === null || !room.includes(standing)) return false
    }
    return true
  }

  // `For` diffs by reference, so a freshly built entry object makes it drop the
  // row's DOM and mount a replacement. A button swapped out between mousedown and
  // mouseup never fires its click, which is why entries are cached per key: a
  // re-run over an unchanged config hands `For` the very same objects back.
  const entryCache = new Map<string, TreeEntry>()
  const entryFor = (el: CustomUiElement, child: boolean, key: string): TreeEntry => {
    const cached = entryCache.get(key)
    if (cached && cached.el === el && cached.child === child) return cached
    const entry: TreeEntry = { el, child, key }
    entryCache.set(key, entry)
    return entry
  }

  // Flat render list. A header's showIf gates its whole group; a header that
  // has items but no visible ones disappears along with them.
  const visibleTree = createMemo((): TreeEntry[] => {
    const out: TreeEntry[] = []
    allElements().forEach((el, i) => {
      if (!isVisible(el)) return
      const key = `${props.mode}:${i}`
      if (el.type === 'header' && el.items && el.items.length > 0) {
        const children = el.items
          .map((sub, j) => entryFor(sub, true, `${key}.${j}`))
          .filter((entry) => isVisible(entry.el))
        if (children.length === 0) return
        out.push(entryFor(el, false, key), ...children)
        return
      }
      out.push(entryFor(el, false, key))
    })
    return out
  })

  // Live values for status elements: subscribe each path on the shard being
  // viewed; re-run when the config or shard changes. All configured paths are
  // subscribed regardless of visibility so filter flapping doesn't churn subs.
  createEffect(() => {
    const c = client()
    const paths = [...new Set(
      allElements()
        .flatMap((el) => [el, ...(el.items ?? [])])
        .filter((el) => el.type === 'status')
        .map((el) => el.path!),
    )]
    const shard = props.shard
    if (!c || paths.length === 0) return
    const subs = paths.map((p) => c.stores.user.subscribeMemory(p, shard))
    const listener = c.stores.user.on('user:memory', (data) => {
      setStatusValues(data.path, data.value)
    })
    onCleanup(() => {
      for (const sub of subs) sub.dispose()
      listener.dispose()
    })
  })

  const needMet = (need: CustomUiNeed): boolean => {
    switch (need) {
      case 'room': return props.mode === 'map' ? !!props.selectedRoomInfo : !!props.room
      case 'selection': return props.mode === 'room' && selection().length > 0
      case 'tile': return props.mode === 'room' && pendingTile() !== null
    }
  }

  const unmetNeeds = (el: CustomUiElement): CustomUiNeed[] =>
    (el.needs ?? []).filter((n) => !needMet(n))

  const isPending = (key: string): boolean => {
    const id = inflight[key]
    return !!id && pendingIds().has(id)
  }

  const buildContext = (): CustomUiContext => {
    if (props.mode === 'map') {
      return { view: 'map', shard: props.shard, room: props.selectedRoomInfo?.room }
    }
    const sel = selection()
    const tile = pendingTile()
    return {
      view: 'room',
      shard: props.shard,
      room: props.room,
      selection: sel.length > 0
        ? sel.map((s) => ({ id: s.id, type: s.type, name: (s.raw as { name?: string }).name }))
        : undefined,
      tile: tile ? { x: tile.tx, y: tile.ty } : undefined,
    }
  }

  const handleTrigger = (el: CustomUiElement, key: string, value?: string) => {
    if (el.confirm && confirming() !== key) {
      setConfirming(key)
      window.clearTimeout(confirmTimer)
      confirmTimer = window.setTimeout(() => setConfirming(null), 3000)
      return
    }
    window.clearTimeout(confirmTimer)
    setConfirming(null)
    const id = dispatchCustomUi(el, buildContext(), value)
    if (id) setInflight(key, id)
  }

  const buttonStyle = (disabled: boolean, isConfirming: boolean) => ({
    padding: '5px 10px',
    'border-radius': '4px',
    border: `1px solid ${isConfirming ? '#da3633' : '#30363d'}`,
    background: isConfirming ? '#3d1a1a' : '#21262d',
    color: disabled ? '#484f58' : isConfirming ? '#f85149' : '#c9d1d9',
    'font-size': '12px',
    cursor: disabled ? 'default' : 'pointer',
  } as const)

  return (
    <Show when={!isGuest() && uiSegment() !== null && (visibleTree().length > 0 || uiError())}>
      <div style={{ 'border-top': '1px solid #30363d', padding: '8px 10px', 'flex-shrink': 0 }}>
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'font-size': '10px',
            'font-weight': 700,
            color: '#8b949e',
            'text-transform': 'uppercase',
            'letter-spacing': '0.06em',
            'margin-bottom': '6px',
          }}
        >
          <span>Custom UI</span>
          <button
            onClick={() => void loadCustomUi()}
            title="Reload from segment"
            disabled={uiLoading()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: uiLoading() ? 'default' : 'pointer',
              padding: '2px',
              display: 'flex',
              'align-items': 'center',
              opacity: uiLoading() ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>

        <Show when={uiError()}>
          <div style={{ 'font-size': '11px', color: '#f85149', 'margin-bottom': '4px' }}>{uiError()}</div>
        </Show>

        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <For each={visibleTree()}>
            {(entry, i) => {
              const el = entry.el
              const missing = () => unmetNeeds(el)
              const busy = () => isPending(entry.key)
              const disabled = () => missing().length > 0 || busy()
              const isConfirming = () => confirming() === entry.key
              const tooltip = () => missing().length > 0
                ? `Requires ${missing().map((n) => NEED_LABELS[n]).join(' and ')}`
                : el.cmd
              const indent = entry.child ? { 'margin-left': '10px' } : {}
              const label = (text: string) => busy() ? `${text} …` : text
              return (
                <Switch>
                  <Match when={el.type === 'header'}>
                    <div
                      style={{
                        'font-size': '10px',
                        'font-weight': 700,
                        color: '#8b949e',
                        'text-transform': 'uppercase',
                        'letter-spacing': '0.06em',
                        'margin-top': i() === 0 ? '0' : '6px',
                        'border-bottom': '1px solid #21262d',
                        'padding-bottom': '2px',
                      }}
                    >
                      {el.label}
                    </div>
                  </Match>

                  <Match when={el.type === 'status'}>
                    <div style={{ display: 'flex', 'justify-content': 'space-between', gap: '8px', 'font-size': '12px', padding: '1px 0', ...indent }}>
                      <span style={{ color: '#8b949e', 'flex-shrink': 0 }}>{el.label}</span>
                      <span
                        title={`Memory.${el.path}`}
                        style={{
                          color: '#c9d1d9',
                          'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                      >
                        {formatStatusValue(statusValues[el.path!])}
                      </span>
                    </div>
                  </Match>

                  <Match when={el.type === 'select'}>
                    <div style={{ display: 'flex', gap: '4px', ...indent }}>
                      <select
                        value={selectValues[entry.key] ?? el.options![0]}
                        onChange={(e) => setSelectValues(entry.key, e.currentTarget.value)}
                        title={el.label}
                        style={{
                          flex: 1,
                          'min-width': 0,
                          background: '#161b22',
                          color: '#c9d1d9',
                          border: '1px solid #30363d',
                          'border-radius': '4px',
                          padding: '4px 6px',
                          'font-size': '12px',
                        }}
                      >
                        <For each={el.options!}>
                          {(o) => <option value={o}>{o}</option>}
                        </For>
                      </select>
                      <button
                        onClick={() => handleTrigger(el, entry.key, selectValues[entry.key] ?? el.options![0])}
                        disabled={disabled()}
                        title={tooltip()}
                        style={{ ...buttonStyle(disabled(), isConfirming()), 'flex-shrink': 0 }}
                      >
                        {isConfirming() ? 'confirm?' : label(el.label)}
                      </button>
                    </div>
                  </Match>

                  <Match when={el.type === 'button'}>
                    <button
                      onClick={() => handleTrigger(el, entry.key)}
                      disabled={disabled()}
                      title={tooltip()}
                      style={{ ...buttonStyle(disabled(), isConfirming()), 'text-align': 'left', ...indent }}
                    >
                      {isConfirming() ? `${el.label} — confirm?` : label(el.label)}
                    </button>
                  </Match>
                </Switch>
              )
            }}
          </For>
        </div>
      </div>
    </Show>
  )
}
