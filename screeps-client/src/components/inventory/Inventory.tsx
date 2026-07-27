import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { X, Package } from 'lucide-solid'
import type { ApiDecorationTheme, ApiUserDecorationItem } from 'screeps-connectivity'
import { OverlayPage } from '~/components/OverlayPage.js'
import { client, userInfo } from '~/stores/clientStore.js'
import { goToGame, goToInventory, goToRoom, inventoryItemId } from '~/stores/routeStore.js'
import { BG, PANEL, PANEL_RAISED, BTN, BORDER, TEXT, MUTED, DIM, ACCENT } from '~/components/theme.js'
import { DECORATION_TYPE_LABELS, rarityColor, SORTS, sortItems, type SortKey } from './sorting.js'
import { DecorationDialog, type RoomOption } from './DecorationDialog.js'

// Every decoration the account owns. Clicking one opens the editor, which places or
// removes it. Pixelization and Steam transfer are not wired up.

const ALL = ''

function selectStyle() {
  return {
    background: BTN,
    color: TEXT,
    border: `1px solid ${BORDER}`,
    'border-radius': '6px',
    padding: '4px 8px',
    'font-size': '12px',
  }
}

function DecorationCard(props: {
  item: ApiUserDecorationItem
  onOpenRoom: (room: string, shard: string | null) => void
  onEdit: () => void
}) {
  const decoration = () => props.item.decoration
  const preview = () => decoration().preview?.['256x256'] ?? decoration().preview?.['128x128'] ?? decoration().preview?.original
  const active = () => props.item.active
  const room = () => {
    const a = active()
    return typeof a?.room === 'string' ? a.room : null
  }
  const shard = () => {
    const a = active()
    return typeof a?.shard === 'string' ? a.shard : null
  }
  // creep and badge decorations have no target room — they apply account-wide.
  const global = () => active() != null && room() == null

  return (
    <div
      onClick={() => props.onEdit()}
      title="Edit"
      style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        'border-radius': '8px',
        overflow: 'hidden',
        display: 'flex',
        'flex-direction': 'column',
        cursor: 'pointer',
      }}
    >
      <div style={{
        height: '120px',
        background: BG,
        'border-bottom': `1px solid ${BORDER}`,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
      }}>
        <Show when={preview()} fallback={<Package size={28} color={DIM} />}>
          {(src) => <img src={src()} alt="" style={{ 'max-width': '100%', 'max-height': '100%', 'object-fit': 'contain' }} />}
        </Show>
      </div>

      <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '4px', flex: 1 }}>
        <div style={{
          'font-size': '12px',
          'font-weight': 600,
          color: rarityColor(decoration().rarity),
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'white-space': 'nowrap',
        }}>
          {decoration().name ?? DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
        </div>
        <div style={{ 'font-size': '11px', color: MUTED }}>
          {DECORATION_TYPE_LABELS[decoration().type] ?? decoration().type}
        </div>

        <div style={{ 'margin-top': 'auto', 'padding-top': '4px', 'font-size': '11px' }}>
          <Show when={room()} fallback={
            <span style={{ color: global() ? TEXT : DIM }}>{global() ? 'Global active' : 'Not activated'}</span>
          }>
            {(name) => (
              <button
                onClick={(e) => { e.stopPropagation(); props.onOpenRoom(name(), shard()) }}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: ACCENT, cursor: 'pointer', 'font-size': '11px',
                }}
              >
                {name()}
              </button>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}

export function Inventory() {
  const [type, setType] = createSignal(ALL)
  const [theme, setTheme] = createSignal(ALL)
  const [room, setRoom] = createSignal('')
  const [sort, setSort] = createSignal<SortKey>('newest')

  // Each resource takes its dependency as a source signal rather than reading it inside
  // the fetcher: the plain form runs exactly once, so anything that wasn't ready at mount
  // — the client, or the user id the room list needs — would stay missing for good.
  const [inventory, { refetch }] = createResource(client, async (c): Promise<ApiUserDecorationItem[]> => {
    try {
      return (await c.http.user.decorations.inventory()).list ?? []
    } catch {
      // Servers without the decoration feature answer 404 — an empty inventory is
      // the honest rendering of that.
      return []
    }
  })

  const [themes] = createResource(client, async (c): Promise<ApiDecorationTheme[]> => {
    try {
      return (await c.http.user.decorations.themes()).list ?? []
    } catch {
      return []
    }
  })

  // Only themes the user actually owns something from, and never a hidden one —
  // a filter that can only ever return nothing is noise.
  const themeOptions = createMemo(() => {
    const owned = new Set((inventory() ?? []).map(i => i.decoration.theme).filter(t => t != null))
    return (themes() ?? []).filter(t => !t.hidden && owned.has(t._id))
  })

  const typeOptions = createMemo(() => {
    const present = new Set((inventory() ?? []).map(i => i.decoration.type))
    return Object.keys(DECORATION_TYPE_LABELS).filter(t => present.has(t as never))
  })

  const filtered = createMemo(() => {
    const roomFilter = room().trim().toLowerCase()
    const items = (inventory() ?? []).filter((item) => {
      if (type() !== ALL && item.decoration.type !== type()) return false
      if (theme() !== ALL && item.decoration.theme !== theme()) return false
      if (roomFilter) {
        const target = typeof item.active?.room === 'string' ? item.active.room.toLowerCase() : ''
        if (!target.includes(roomFilter)) return false
      }
      return true
    })
    return sortItems(items, sort())
  })

  // "Rooms" sorting also groups, the way the reference client does; every other
  // sort renders one flat grid.
  const groups = createMemo(() => {
    if (sort() !== 'room') return [{ label: null as string | null, items: filtered() }]
    const byRoom = new Map<string, ApiUserDecorationItem[]>()
    for (const item of filtered()) {
      const key = typeof item.active?.room === 'string' ? item.active.room : 'Not activated'
      const bucket = byRoom.get(key)
      if (bucket) bucket.push(item)
      else byRoom.set(key, [item])
    }
    return [...byRoom.entries()].map(([label, items]) => ({ label, items }))
  })

  // Rooms the account can place a decoration in: owned first, then reserved.
  const [rooms, { refetch: refetchRooms }] = createResource(
    () => {
      const c = client()
      const id = userInfo()?._id
      return c && id ? ({ c, id } as const) : undefined
    },
    async ({ c, id }): Promise<RoomOption[]> => {
    try {
      const res = await c.http.user.rooms(id, true)
      const out: RoomOption[] = []
      const collect = (source: Record<string, string[]> | undefined, reserved: boolean) => {
        for (const [shard, names] of Object.entries(source ?? {})) {
          for (const name of names) out.push({ shard, room: name, reserved })
        }
      }
      collect(res.shards, false)
      // Single-shard servers answer with a flat list instead of a shard map.
      for (const name of res.rooms ?? []) out.push({ shard: null, room: name, reserved: false })
      collect(res.reservations, true)
      return out
    } catch {
      return []
    }
    },
  )

  // The open editor lives in the URL (/inventory/<id>), so a link from anywhere — the
  // room sidebar, say — can open it without owning the dialog or its data.
  const editing = createMemo(() => {
    const id = inventoryItemId()
    if (!id) return null
    return (inventory() ?? []).find(item => item._id === id) ?? null
  })

  // Claiming or losing a room mid-session would otherwise leave a stale picker, and
  // opening the editor is a cheap, explicit moment to refresh it.
  createEffect(() => {
    if (inventoryItemId()) void refetchRooms()
  })

  const openRoom = (name: string, shard: string | null) => goToRoom(name, shard)

  return (
    <OverlayPage maxWidth="1200px">
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '16px' }}>
        <Package size={20} color={ACCENT} />
        <h1 style={{ margin: 0, 'font-size': '18px', 'font-weight': 600 }}>Inventory</h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={goToGame}
          title="Close"
          style={{
            background: 'transparent', border: 'none', color: MUTED,
            cursor: 'pointer', display: 'flex', padding: '4px',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{
        display: 'flex', 'flex-wrap': 'wrap', gap: '8px', 'align-items': 'center',
        background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px',
        padding: '8px', 'margin-bottom': '16px',
      }}>
        <select value={type()} onChange={e => setType(e.currentTarget.value)} style={selectStyle()}>
          <option value={ALL}>All types</option>
          <For each={typeOptions()}>{t => <option value={t}>{DECORATION_TYPE_LABELS[t]}</option>}</For>
        </select>

        <select value={theme()} onChange={e => setTheme(e.currentTarget.value)} style={selectStyle()}>
          <option value={ALL}>All themes</option>
          <For each={themeOptions()}>{t => <option value={t._id}>{t.name}</option>}</For>
        </select>

        <input
          value={room()}
          onInput={e => setRoom(e.currentTarget.value)}
          placeholder="Room"
          style={{ ...selectStyle(), width: '110px' }}
        />

        <div style={{ flex: 1 }} />

        <select value={sort()} onChange={e => setSort(e.currentTarget.value as SortKey)} style={selectStyle()}>
          <For each={SORTS}>{s => <option value={s.key}>{s.label}</option>}</For>
        </select>
      </div>

      <Show when={!inventory.loading} fallback={<div style={{ color: MUTED, 'font-size': '13px' }}>Loading…</div>}>
        <Show when={filtered().length > 0} fallback={
          <div style={{
            background: PANEL_RAISED, border: `1px solid ${BORDER}`, 'border-radius': '8px',
            padding: '24px', 'text-align': 'center', color: MUTED, 'font-size': '13px',
          }}>
            <Show when={(inventory() ?? []).length > 0} fallback="This account owns no decorations.">
              No decoration matches these filters.
            </Show>
          </div>
        }>
          <For each={groups()}>
            {(group) => (
              <div style={{ 'margin-bottom': '20px' }}>
                <Show when={group.label}>
                  <div style={{
                    'font-size': '11px', 'font-weight': 600, color: MUTED,
                    'text-transform': 'uppercase', 'letter-spacing': '0.04em', 'margin-bottom': '8px',
                  }}>
                    {group.label}
                  </div>
                </Show>
                <div style={{
                  display: 'grid',
                  'grid-template-columns': 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '12px',
                }}>
                  <For each={group.items}>
                    {item => <DecorationCard item={item} onOpenRoom={openRoom} onEdit={() => goToInventory(item._id)} />}
                  </For>
                </div>
              </div>
            )}
          </For>
        </Show>
      </Show>

      <Show when={editing()}>
        {(item) => (
          <DecorationDialog
            item={item()}
            inventory={inventory() ?? []}
            rooms={rooms() ?? []}
            onClose={() => goToInventory()}
            onChanged={() => void refetch()}
          />
        )}
      </Show>
    </OverlayPage>
  )
}
