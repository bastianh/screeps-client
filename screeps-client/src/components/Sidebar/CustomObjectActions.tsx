import { createMemo, createSignal, For, Show, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  uiConfig, dispatchCustomUi, pendingIds, matchesObject,
  type CustomUiElement, type CustomUiContext,
} from '~/stores/customUiStore.js'
import { selection, type SelectedObject } from '~/stores/selectionStore.js'
import { pendingTile } from '~/stores/roomViewStore.js'
import { currentRoom, currentShard } from '~/stores/roomDataStore.js'
import { historyMode } from '~/stores/historyStore.js'

interface ActionEntry {
  el: CustomUiElement
  key: string
}

// Player-defined actions attached to a selected object's card in the
// SelectionList: every `objects` element of the custom UI config whose
// obj/owner filters match this object. Commands carry the object as
// `ctx.target` alongside the usual room context.
export function CustomObjectActions(props: { item: SelectedObject }) {
  const [confirming, setConfirming] = createSignal<string | null>(null)
  const [selectValues, setSelectValues] = createStore<Record<string, string>>({})
  const [inflight, setInflight] = createStore<Record<string, string>>({})
  let confirmTimer: number | undefined
  onCleanup(() => window.clearTimeout(confirmTimer))

  const objUser = () => {
    const user = (props.item.raw as { user?: unknown }).user
    return typeof user === 'string' ? user : null
  }

  // `For` diffs by reference, so rebuilding these wrappers on every re-run would
  // replace each button's DOM node — and a button swapped out between mousedown
  // and mouseup never fires its click. Cached per key so an unchanged config
  // yields the identical objects again.
  const entryCache = new Map<string, ActionEntry>()
  const entryFor = (el: CustomUiElement, key: string): ActionEntry => {
    const cached = entryCache.get(key)
    if (cached && cached.el === el) return cached
    const entry: ActionEntry = { el, key }
    entryCache.set(key, entry)
    return entry
  }

  const elements = createMemo((): ActionEntry[] => {
    const cfg = uiConfig()
    if (!cfg || historyMode()) return []
    return cfg.objects
      .map((el, i) => entryFor(el, `obj:${i}:${props.item.id}`))
      .filter(({ el }) => matchesObject(el, props.item.type, objUser()))
  })

  const isPending = (key: string): boolean => {
    const id = inflight[key]
    return !!id && pendingIds().has(id)
  }

  const buildContext = (): CustomUiContext => {
    const raw = props.item.raw as { name?: string; x?: number; y?: number }
    const sel = selection()
    const tile = pendingTile()
    return {
      view: 'room',
      shard: currentShard(),
      room: currentRoom() ?? undefined,
      selection: sel.length > 0
        ? sel.map((s) => ({ id: s.id, type: s.type, name: (s.raw as { name?: string }).name }))
        : undefined,
      tile: tile ? { x: tile.tx, y: tile.ty } : undefined,
      target: {
        id: props.item.id,
        type: props.item.type,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        x: typeof raw.x === 'number' ? raw.x : undefined,
        y: typeof raw.y === 'number' ? raw.y : undefined,
      },
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
    padding: '4px 8px',
    'border-radius': '4px',
    border: `1px solid ${isConfirming ? '#da3633' : '#30363d'}`,
    background: isConfirming ? '#3d1a1a' : '#21262d',
    color: disabled ? '#484f58' : isConfirming ? '#f85149' : '#c9d1d9',
    'font-size': '11px',
    cursor: disabled ? 'default' : 'pointer',
  } as const)

  return (
    <Show when={elements().length > 0}>
      <div
        style={{
          display: 'flex',
          'flex-wrap': 'wrap',
          gap: '4px',
          padding: '6px 8px',
          background: '#0d1117',
          'border-top': '1px solid #21262d',
        }}
      >
        <For each={elements()}>
          {({ el, key }) => {
            const busy = () => isPending(key)
            const isConfirming = () => confirming() === key
            const label = () => busy() ? `${el.label} …` : isConfirming() ? `${el.label} — confirm?` : el.label
            return (
              <Show
                when={el.type === 'select'}
                fallback={
                  <button
                    onClick={() => handleTrigger(el, key)}
                    disabled={busy()}
                    title={el.cmd}
                    style={buttonStyle(busy(), isConfirming())}
                  >
                    {label()}
                  </button>
                }
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select
                    value={selectValues[key] ?? el.options![0]}
                    onChange={(e) => setSelectValues(key, e.currentTarget.value)}
                    title={el.label}
                    style={{
                      background: '#161b22',
                      color: '#c9d1d9',
                      border: '1px solid #30363d',
                      'border-radius': '4px',
                      padding: '3px 5px',
                      'font-size': '11px',
                      'min-width': 0,
                    }}
                  >
                    <For each={el.options!}>
                      {(o) => <option value={o}>{o}</option>}
                    </For>
                  </select>
                  <button
                    onClick={() => handleTrigger(el, key, selectValues[key] ?? el.options![0])}
                    disabled={busy()}
                    title={el.cmd}
                    style={buttonStyle(busy(), isConfirming())}
                  >
                    {busy() ? '…' : isConfirming() ? 'confirm?' : el.label}
                  </button>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
