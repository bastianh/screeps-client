import { createMemo, createSignal, For, Show, untrack } from 'solid-js'
import { X } from 'lucide-solid'
import type { ApiDecorationProp, ApiRoomDecorationActive, ApiUserDecorationItem } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { addToast } from '~/stores/toastStore.js'
import { BG, PANEL, PANEL_RAISED, BTN, BORDER, TEXT, MUTED, DIM, GREEN, RED } from '~/components/theme.js'
import { DECORATION_TYPE_LABELS, rarityColor } from './sorting.js'
import {
  ANIMATION_OPTIONS, blockedRooms, buildActiveState, editorGroups, joinList, needsRoom, roomKey, splitList,
} from './activation.js'

// Editor for one decoration: its properties, its target room, and the activate /
// deactivate actions. Geometry properties show as plain numeric controls here; the
// drag-and-drop position editor is a separate step.

export interface RoomOption {
  shard: string | null
  room: string
  /** Reserved rather than owned — the reference lists these in their own group. */
  reserved: boolean
}

interface DialogProps {
  item: ApiUserDecorationItem
  /** Everything the account owns, for the room-collision check. */
  inventory: readonly ApiUserDecorationItem[]
  rooms: readonly RoomOption[]
  onClose: () => void
  onChanged: () => void
}

function label(name: string, descriptor: ApiDecorationProp): string {
  return descriptor.label ?? name
}

function Row(props: { label: string; children: unknown }) {
  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'min-height': '26px' }}>
      <div style={{ 'font-size': '11px', color: MUTED, width: '130px', 'flex-shrink': 0 }}>{props.label}</div>
      <div style={{ flex: 1, display: 'flex', 'align-items': 'center', gap: '6px' }}>{props.children as never}</div>
    </div>
  )
}

function Section(props: { title: string; children: unknown }) {
  return (
    <div style={{ 'margin-bottom': '14px' }}>
      <div style={{
        'font-size': '10px', 'font-weight': 600, color: MUTED,
        'text-transform': 'uppercase', 'letter-spacing': '0.04em', 'margin-bottom': '6px',
      }}>
        {props.title}
      </div>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>{props.children as never}</div>
    </div>
  )
}

const inputStyle = {
  background: BTN,
  color: TEXT,
  border: `1px solid ${BORDER}`,
  'border-radius': '6px',
  padding: '3px 6px',
  'font-size': '12px',
}

export function DecorationDialog(props: DialogProps) {
  const decoration = () => props.item.decoration
  const groups = createMemo(() => editorGroups(decoration()))

  const [active, setActive] = createSignal<ApiRoomDecorationActive>(
    untrack(() => buildActiveState(props.item.decoration, props.item.active)),
  )
  const [busy, setBusy] = createSignal(false)

  const set = (name: string, value: unknown) => setActive(prev => ({ ...prev, [name]: value }))

  const wasActive = () => props.item.active != null
  const requiresRoom = () => needsRoom(decoration().type)

  const blocked = createMemo(() => blockedRooms(props.inventory, decoration().type, props.item._id))
  const selectedRoom = () => {
    const a = active()
    return typeof a.room === 'string' && a.room !== ''
      ? roomKey(typeof a.shard === 'string' ? a.shard : null, a.room)
      : ''
  }

  const canActivate = () => !busy() && (!requiresRoom() || selectedRoom() !== '')

  const activate = async () => {
    const c = client()
    if (!c) return
    setBusy(true)
    try {
      await c.http.user.decorations.activate(props.item._id, active())
      addToast('Decoration activated', 'success')
      props.onChanged()
      props.onClose()
    } catch (err) {
      addToast(`Could not activate: ${err instanceof Error ? err.message : String(err)}`, 'error', 8000)
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    const c = client()
    if (!c) return
    setBusy(true)
    try {
      await c.http.user.decorations.deactivate([props.item._id])
      addToast('Decoration deactivated', 'success')
      props.onChanged()
      props.onClose()
    } catch (err) {
      addToast(`Could not deactivate: ${err instanceof Error ? err.message : String(err)}`, 'error', 8000)
    } finally {
      setBusy(false)
    }
  }

  const nameFilter = () => splitList(active().nameFilter)
  const addNameFilter = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '' || nameFilter().includes(trimmed)) return
    set('nameFilter', joinList([...nameFilter(), trimmed]))
  }
  const removeNameFilter = (value: string) => {
    set('nameFilter', joinList(nameFilter().filter(f => f !== value)))
  }

  const preview = () => decoration().preview?.['256x256'] ?? decoration().preview?.original

  return (
    <div
      style={{
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.65)', 'z-index': 200,
        display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}
    >
      <div style={{
        background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '10px',
        width: '560px', 'max-height': '90vh', display: 'flex', 'flex-direction': 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', 'align-items': 'center', gap: '10px',
          padding: '10px 12px', 'border-bottom': `1px solid ${BORDER}`,
        }}>
          <Show when={preview()}>
            {(src) => <img src={src()} alt="" style={{ width: '32px', height: '32px', 'object-fit': 'contain' }} />}
          </Show>
          <div style={{ 'min-width': 0 }}>
            <div style={{ 'font-size': '13px', 'font-weight': 600, color: rarityColor(decoration().rarity) }}>
              {decoration().name ?? DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
            </div>
            <div style={{ 'font-size': '11px', color: MUTED }}>
              {DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => props.onClose()}
            style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px', overflow: 'auto', flex: 1 }}>
          <Show when={decoration().groupDescription}>
            <div style={{ 'font-size': '11px', color: MUTED, 'margin-bottom': '12px' }}>
              {decoration().groupDescription}
            </div>
          </Show>

          <Show when={requiresRoom()}>
            <Section title="Room">
              <Row label="Target">
                <select
                  value={selectedRoom()}
                  onChange={(e) => {
                    const option = props.rooms.find(r => roomKey(r.shard, r.room) === e.currentTarget.value)
                    setActive(prev => ({ ...prev, room: option?.room ?? '', shard: option?.shard ?? undefined }))
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Select a room…</option>
                  <For each={props.rooms}>
                    {(option) => {
                      const key = roomKey(option.shard, option.room)
                      const conflict = blocked().get(key)
                      return (
                        <option value={key} disabled={conflict != null}>
                          {option.room}
                          {option.shard ? ` (${option.shard})` : ''}
                          {option.reserved ? ' — reserved' : ''}
                          {conflict ? ' — taken' : ''}
                        </option>
                      )
                    }}
                  </For>
                </select>
              </Row>
              <Show when={props.rooms.length === 0}>
                <div style={{ 'font-size': '11px', color: DIM }}>No rooms available on this account.</div>
              </Show>
            </Section>
          </Show>

          <Show when={groups().colors.length > 0}>
            <Section title="Colors">
              <For each={groups().colors}>
                {([name, descriptor]) => (
                  <Row label={label(name, descriptor)}>
                    <input
                      type="color"
                      value={typeof active()[name] === 'string' ? String(active()[name]) : '#ffffff'}
                      onInput={e => set(name, e.currentTarget.value)}
                      style={{ width: '40px', height: '22px', background: 'transparent', border: `1px solid ${BORDER}`, 'border-radius': '4px', padding: 0 }}
                    />
                    <span style={{ 'font-size': '11px', color: DIM }}>{String(active()[name] ?? '')}</span>
                  </Row>
                )}
              </For>
            </Section>
          </Show>

          <Show when={groups().ranges.length > 0}>
            <Section title="Values">
              <For each={groups().ranges}>
                {([name, descriptor]) => (
                  <Row label={label(name, descriptor)}>
                    <input
                      type="range"
                      min={descriptor.min ?? 0}
                      max={descriptor.max ?? 1}
                      step={descriptor.step ?? 0.01}
                      value={Number(active()[name] ?? descriptor.default ?? 0)}
                      onInput={e => set(name, Number(e.currentTarget.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ 'font-size': '11px', color: DIM, width: '48px', 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>
                      {Number(active()[name] ?? 0)}
                    </span>
                  </Row>
                )}
              </For>
            </Section>
          </Show>

          <Show when={groups().displays.length > 0}>
            <Section title="Display">
              <For each={groups().displays}>
                {([name, descriptor]) => (
                  <Row label={label(name, descriptor)}>
                    <input
                      type="checkbox"
                      checked={!!active()[name]}
                      onChange={e => set(name, e.currentTarget.checked)}
                    />
                  </Row>
                )}
              </For>
            </Section>
          </Show>

          <Show when={groups().animation}>
            {(entry) => (
              <Section title="Animation">
                <Row label={label(entry()[0], entry()[1])}>
                  <select
                    value={String(active()[entry()[0]] ?? '')}
                    onChange={e => set(entry()[0], e.currentTarget.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <For each={ANIMATION_OPTIONS}>
                      {(option) => <option value={option}>{option === '' ? 'None' : option}</option>}
                    </For>
                  </select>
                </Row>
              </Section>
            )}
          </Show>

          <Show when={decoration().type === 'creep'}>
            <Section title="Creep filter">
              <Row label="Names">
                <input
                  placeholder="Add a filter…"
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    addNameFilter(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }}
                />
              </Row>
              <Show when={nameFilter().length > 0}>
                <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px', 'padding-left': '138px' }}>
                  <For each={nameFilter()}>
                    {(filter) => (
                      <button
                        onClick={() => removeNameFilter(filter)}
                        title="Remove"
                        style={{
                          background: PANEL_RAISED, border: `1px solid ${BORDER}`, 'border-radius': '10px',
                          color: TEXT, 'font-size': '11px', padding: '1px 8px', cursor: 'pointer',
                        }}
                      >
                        {filter} ×
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <Row label="Exclude matches">
                <input type="checkbox" checked={!!active().exclude} onChange={e => set('exclude', e.currentTarget.checked)} />
              </Row>
              <div style={{ 'font-size': '11px', color: DIM, 'padding-left': '138px' }}>
                An empty filter matches every creep.
              </div>
            </Section>
          </Show>

          <Show when={groups().inputs.length > 0}>
            <Section title="Other">
              <For each={groups().inputs}>
                {([name, descriptor]) => (
                  <Show when={name !== 'nameFilter' || decoration().type !== 'creep'}>
                    <Row label={label(name, descriptor)}>
                      <input
                        value={String(active()[name] ?? '')}
                        onInput={e => set(name, e.currentTarget.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </Row>
                  </Show>
                )}
              </For>
            </Section>
          </Show>
        </div>

        <div style={{
          display: 'flex', gap: '8px', 'align-items': 'center',
          padding: '10px 12px', 'border-top': `1px solid ${BORDER}`, background: BG,
        }}>
          <Show when={wasActive()}>
            <button
              onClick={deactivate}
              disabled={busy()}
              style={{
                background: 'transparent', border: `1px solid ${BORDER}`, 'border-radius': '6px',
                color: RED, 'font-size': '12px', padding: '5px 12px', cursor: busy() ? 'default' : 'pointer',
              }}
            >
              Deactivate
            </button>
          </Show>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => props.onClose()}
            style={{
              background: BTN, border: `1px solid ${BORDER}`, 'border-radius': '6px',
              color: TEXT, 'font-size': '12px', padding: '5px 12px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={activate}
            disabled={!canActivate()}
            title={requiresRoom() && selectedRoom() === '' ? 'Pick a room first' : undefined}
            style={{
              background: canActivate() ? GREEN : BTN, border: `1px solid ${BORDER}`, 'border-radius': '6px',
              color: canActivate() ? '#fff' : DIM, 'font-size': '12px', padding: '5px 12px',
              cursor: canActivate() ? 'pointer' : 'default',
            }}
          >
            {wasActive() ? 'Save' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}
