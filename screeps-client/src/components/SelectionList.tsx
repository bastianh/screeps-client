import { For, Show, createSignal } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Trash2, Flag, Eye } from 'lucide-solid'
import { selection, deselectItem } from '~/stores/selectionStore.js'
import { client, userInfo } from '~/stores/clientStore.js'
import { setTempWatchFor } from '~/stores/memoryStore.js'
import { setShowMemory } from '~/stores/consoleStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { roomOwner, currentShard, currentRoom } from '~/stores/roomDataStore.js'
import { createLogger } from '~/utils/log.js'
import { CustomObjectActions } from '~/components/Sidebar/CustomObjectActions.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { OBJECT_COLORS, TYPE_LABELS } from './selection/shared.js'
import { CUSTOM_DETAILS, DefaultDetails } from './selection/registry.js'

const { error } = createLogger('SelectionList')

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
    c.http.game.removeFlag(raw.room as string, raw.name as string, currentShard() ?? undefined)
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
    if (props.item.type === 'constructionSite') {
      c.http.game.removeConstructionSite(room, [id], currentShard() ?? undefined)
        .then(() => deselectItem(id))
        .catch((err: Error) => error('removeConstructionSite failed:', err))
    } else {
      const userId = typeof raw.user === 'string' ? raw.user : (roomOwner()?.userId ?? '')
      c.http.game.addObjectIntent('room', room, 'destroyStructure', [{ id, roomName: room, user: userId }], currentShard())
        .then(() => deselectItem(id))
        .catch((err: Error) => error('destroyStructure failed:', err))
    }
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
    c.http.game.addObjectIntent(id, currentRoom() ?? (props.item.raw.room as string) ?? '', 'suicide', { id }, currentShard())
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
            title={destroyConfirming() ? 'Click again to confirm' : props.item.type === 'constructionSite' ? 'Remove construction site' : 'Destroy structure'}
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

      <CustomObjectActions item={props.item} />

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
