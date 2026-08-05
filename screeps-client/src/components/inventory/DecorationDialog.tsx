import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js'
import { X } from 'lucide-solid'
import type { ApiRoomDecorationActive, ApiUserDecorationItem } from 'screeps-connectivity'
import { BG, PANEL, BTN, BORDER, TEXT, MUTED, DIM, GREEN, RED, ACCENT } from '~/components/theme.js'
import { currentRoom, currentShard } from '~/stores/roomDataStore.js'
import { goToGame } from '~/stores/routeStore.js'
import { beginDecorationEdit } from '~/stores/decorationEditStore.js'
import { showRoomDecorations } from '~/stores/settingsStore.js'
import { DECORATION_TYPE_LABELS, rarityColor } from './sorting.js'
import { blockedRooms, buildActiveState, findRoomOption, needsRoom, roomKey } from './activation.js'
import { DecorationPositionEditor } from './DecorationPositionEditor.js'
import { DecorationProperties, Row, Section, inputStyle } from './DecorationProperties.js'
import { editorCapabilities, placementOf, sizeBounds, type Placement } from './positionEditor.js'
import { placeDecoration, unplaceDecoration } from './commit.js'

// Editor for one decoration: its position in the room, its properties, its target room,
// and the activate / deactivate actions.

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

export function DecorationDialog(props: DialogProps) {
  const decoration = () => props.item.decoration

  const [active, setActive] = createSignal<ApiRoomDecorationActive>(
    untrack(() => buildActiveState(props.item.decoration, props.item.active)),
  )
  const [busy, setBusy] = createSignal(false)

  const set = (name: string, value: unknown) => setActive(prev => ({ ...prev, [name]: value }))

  const wasActive = () => props.item.active != null
  const requiresRoom = () => needsRoom(decoration().type)

  const selectedRoomName = () => {
    const room = active().room
    return typeof room === 'string' ? room : ''
  }
  const selectedShard = () => {
    const shard = active().shard
    return typeof shard === 'string' ? shard : null
  }
  /** The picker's key for the chosen room, or '' when none is chosen. */
  const selectedRoom = () => selectedRoomName() === '' ? '' : roomKey(selectedShard(), selectedRoomName())

  const capabilities = createMemo(() => editorCapabilities(decoration()))
  const bounds = createMemo(() => sizeBounds(decoration()))
  const showPositionEditor = createMemo(() => {
    const caps = capabilities()
    return (caps.positionable || caps.resizable || caps.rotatable) && selectedRoomName() !== ''
  })

  const placement = () => placementOf(active())
  const setPlacement = (next: Placement) => setActive(prev => ({ ...prev, ...next }))

  const blocked = createMemo(() => blockedRooms(props.inventory, decoration().type, props.item._id))

  /**
   * Opening the editor while a room is on screen is a strong hint about where an unplaced
   * decoration is meant to go, so the picker starts there.
   *
   * Seeded from an effect rather than the initial state because the room list arrives
   * asynchronously, and only once while nothing is chosen — a choice the user makes, or a
   * room the decoration already sits in, must never be overwritten.
   */
  let seededRoom = false
  createEffect(() => {
    if (seededRoom || wasActive() || !requiresRoom()) return
    if (selectedRoomName() !== '') return

    const room = currentRoom()
    if (!room) return
    const option = findRoomOption(props.rooms, room, currentShard())
    if (!option || blocked().has(roomKey(option.shard, option.room))) return

    seededRoom = true
    setActive(prev => ({ ...prev, room: option.room, shard: option.shard ?? undefined }))
  })

  const canActivate = () => !busy() && (!requiresRoom() || selectedRoom() !== '')

  /**
   * The in-room editor only reaches decorations of the room already on screen, so the
   * hand-off is offered when this decoration is placed there and nowhere else — and only
   * while the room actually draws decorations, since the editor closes with that setting.
   */
  const editableInRoom = () =>
    wasActive()
    && showRoomDecorations()
    && showPositionEditor()
    && selectedRoomName() === currentRoom()
    && selectedShard() === currentShard()

  const editInRoom = () => {
    beginDecorationEdit({
      _id: props.item._id,
      decoration: decoration(),
      active: active(),
      wasActive: wasActive(),
    })
    props.onClose()
    goToGame()
  }

  const activate = async () => {
    setBusy(true)
    const ok = await placeDecoration(props.item._id, active(), wasActive())
    setBusy(false)
    // The server state may have moved either way — let the caller re-read it.
    props.onChanged()
    if (ok) props.onClose()
  }

  const deactivate = async () => {
    setBusy(true)
    const ok = await unplaceDecoration(props.item._id)
    setBusy(false)
    props.onChanged()
    if (ok) props.onClose()
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
        width: showPositionEditor() ? '600px' : '560px',
        'max-height': '90vh', display: 'flex', 'flex-direction': 'column', overflow: 'hidden',
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

          <Show when={decoration().type === 'badge'}>
            <div style={{ 'font-size': '11px', color: MUTED, 'margin-bottom': '12px' }}>
              Activating this decoration unlocks its symbol in the badge editor.
              Deactivating it removes the symbol from the editor, but a badge already saved with it stays as it is.
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

          <Show when={showPositionEditor()}>
            <Section title="Position">
              <DecorationPositionEditor
                room={selectedRoomName()}
                shard={selectedShard()}
                placement={placement()}
                capabilities={capabilities()}
                bounds={bounds()}
                previewUrl={preview()}
                onChange={setPlacement}
              />
              <Show when={editableInRoom()}>
                <button
                  onClick={editInRoom}
                  style={{
                    background: 'transparent', border: 'none', padding: '4px 0',
                    color: ACCENT, cursor: 'pointer', 'font-size': '11px', 'text-align': 'center',
                  }}
                >
                  Edit in the room view instead
                </button>
              </Show>
            </Section>
          </Show>

          <DecorationProperties
            decoration={decoration()}
            active={active()}
            hideGeometry={showPositionEditor()}
            onSet={set}
          />
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
