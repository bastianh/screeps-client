import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import type { ApiUserDecorationItem } from 'screeps-connectivity'
import { PANEL, BTN, BORDER, TEXT, MUTED, DIM } from '~/components/theme.js'
import { DECORATION_TYPE_LABELS, rarityColor, sortItems } from '~/components/inventory/sorting.js'
import { collidingTypes, needsRoom, roomKey } from '~/components/inventory/activation.js'
import { client, userInfo } from '~/stores/clientStore.js'
import { controllerReservation, currentRoom, currentShard, roomOwner } from '~/stores/roomDataStore.js'
import { beginDecorationPlacement } from '~/stores/decorationEditStore.js'

// What decorate mode shows before anything is picked: the decorations this account owns
// but has not placed. Choosing one drops it into the middle of the room as a draft, which
// is then dragged like any already-placed decoration.

/** Types that go into a room. `creep` and `badge` apply account-wide and have no place here. */
function placeableInRoom(item: ApiUserDecorationItem): boolean {
  return item.active == null && needsRoom(item.decoration.type)
}

export function DecorationPicker() {
  const [filter, setFilter] = createSignal('')

  // Mounted only while decorate mode is open, so this reads the inventory exactly when
  // the user asks to place something.
  const [inventory] = createResource(client, async (c): Promise<ApiUserDecorationItem[]> => {
    try {
      return (await c.http.user.decorations.inventory()).list ?? []
    } catch {
      return []
    }
  })

  /**
   * Decorations may only be placed in a room the account holds. Owner and reservation are
   * already on hand from the room subscription, so this costs no extra request.
   */
  const canPlaceHere = () => {
    const id = userInfo()?._id
    if (!id) return false
    return roomOwner()?.userId === id || controllerReservation()?.user === id
  }

  /** Types already spoken for in this room — one landscape per room, and so on. */
  const taken = createMemo(() => {
    const out = new Set<string>()
    const room = currentRoom()
    if (!room) return out

    const key = roomKey(currentShard(), room)
    const items = inventory() ?? []
    const present = new Set<string>()
    for (const item of items) {
      const target = item.active?.room
      if (typeof target !== 'string' || target === '') continue
      const shard = typeof item.active?.shard === 'string' ? item.active.shard : null
      if (roomKey(shard, target) === key) present.add(item.decoration.type)
    }

    for (const item of items) {
      if (collidingTypes(item.decoration.type).some(type => present.has(type))) {
        out.add(item.decoration.type)
      }
    }
    return out
  })

  const candidates = createMemo(() => {
    const needle = filter().trim().toLowerCase()
    const items = (inventory() ?? []).filter((item) => {
      if (!placeableInRoom(item)) return false
      if (needle === '') return true
      const name = item.decoration.name ?? DECORATION_TYPE_LABELS[item.decoration.type] ?? item.decoration.type
      return name.toLowerCase().includes(needle)
    })
    return sortItems(items, 'rarest')
  })

  const place = (item: ApiUserDecorationItem) => {
    const room = currentRoom()
    if (!room || taken().has(item.decoration.type)) return
    beginDecorationPlacement(item._id, item.decoration, room, currentShard())
  }

  return (
    <div style={{ padding: '8px', overflow: 'auto', 'min-height': 0, flex: 1 }}>
      <div style={{
        'font-size': '10px', 'font-weight': 600, color: MUTED,
        'text-transform': 'uppercase', 'letter-spacing': '0.04em', 'margin-bottom': '6px',
      }}>
        Place in {currentRoom() ?? '—'}
      </div>

      <Show when={canPlaceHere()} fallback={
        <div style={{ 'font-size': '11px', color: DIM }}>
          Decorations can only be placed in a room you own or reserve.
        </div>
      }>
        <Show when={!inventory.loading} fallback={<div style={{ 'font-size': '11px', color: MUTED }}>Loading…</div>}>
          <Show when={(inventory() ?? []).some(placeableInRoom)} fallback={
            <div style={{ 'font-size': '11px', color: DIM }}>
              Every decoration this account owns is already placed.
            </div>
          }>
            <input
              value={filter()}
              onInput={e => setFilter(e.currentTarget.value)}
              placeholder="Filter…"
              style={{
                background: BTN, color: TEXT, border: `1px solid ${BORDER}`, 'border-radius': '6px',
                padding: '3px 6px', 'font-size': '12px', width: '100%', 'margin-bottom': '6px',
              }}
            />

            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
              <For each={candidates()}>
                {(item) => {
                  const decoration = () => item.decoration
                  const preview = () => decoration().preview?.['128x128'] ?? decoration().preview?.original
                  const blocked = () => taken().has(decoration().type)
                  return (
                    <div
                      onClick={() => place(item)}
                      title={blocked() ? 'This room already has one of these' : 'Place'}
                      style={{
                        display: 'flex', gap: '8px', 'align-items': 'center',
                        padding: '4px', background: PANEL, border: `1px solid ${BORDER}`,
                        'border-radius': '6px', cursor: blocked() ? 'default' : 'pointer',
                        opacity: blocked() ? '0.45' : '1',
                      }}
                    >
                      <Show when={preview()} fallback={
                        <div style={{
                          width: '24px', height: '24px', 'border-radius': '4px', 'flex-shrink': 0,
                          border: `1px solid ${rarityColor(decoration().rarity)}`,
                        }} />
                      }>
                        <img
                          src={preview()}
                          alt=""
                          style={{
                            width: '24px', height: '24px', 'border-radius': '4px', 'flex-shrink': 0,
                            border: `1px solid ${rarityColor(decoration().rarity)}`, 'object-fit': 'cover',
                          }}
                        />
                      </Show>
                      <div style={{ 'min-width': 0, flex: 1 }}>
                        <div style={{
                          'font-size': '11px', color: TEXT,
                          overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap',
                        }}>
                          {decoration().name ?? DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
                        </div>
                        <div style={{ 'font-size': '10px', color: MUTED }}>
                          {DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
                          {blocked() ? ' — taken' : ''}
                        </div>
                      </div>
                    </div>
                  )
                }}
              </For>
              <Show when={candidates().length === 0}>
                <div style={{ 'font-size': '11px', color: DIM }}>No decoration matches this filter.</div>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
