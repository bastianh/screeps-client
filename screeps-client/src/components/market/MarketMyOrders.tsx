import { createSignal, onMount, For, Show } from 'solid-js'
import { RefreshCw } from 'lucide-solid'
import type { ApiMarketOrder } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { goToMarketResource, goToRoom } from '~/stores/routeStore.js'
import { resourceDisplayName } from '~/data/resources.js'
import { ResourceSwatch } from './ResourceSwatch.js'
import { PANEL, BORDER, TEXT, MUTED, ACCENT, POS, NEG, fmtAmount, fmtPrice } from './theme.js'
import { Card, rowBg } from './ui.js'

interface ShardGroup {
  shard: string | null
  orders: ApiMarketOrder[]
}

// Your own orders, grouped by shard. Multi-shard servers return a `shards` map;
// single-shard servers return a flat list (carried with a null shard).
export function MarketMyOrders() {
  const [groups, setGroups] = createSignal<ShardGroup[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const reload = (): void => {
    const c = client()
    if (!c) return
    setLoading(true)
    void c.http.game.market
      .myOrders()
      .then((res) => {
        if (res.shards) setGroups(Object.entries(res.shards).map(([shard, orders]) => ({ shard, orders })))
        else setGroups([{ shard: null, orders: res.list ?? [] }])
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  onMount(reload)

  const total = () => groups().reduce((sum, g) => sum + g.orders.length, 0)
  const multiShard = () => groups().length > 1

  return (
    <Show
      when={!error()}
      fallback={
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
          Couldn't load your orders.
        </div>
      }
    >
      <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-bottom': '12px' }}>
        <button
          onClick={reload}
          title="Refresh"
          style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '6px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <Show
        when={total()}
        fallback={
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
            You have no orders. Create one with the in-game Market API.
          </div>
        }
      >
        <div style={{ opacity: loading() ? 0.6 : 1 }}>
          <For each={groups()}>
            {(group) => (
              <Show when={group.orders.length}>
                <Card
                  title={multiShard() ? (group.shard ?? 'My orders') : 'My orders'}
                  right={<span style={{ color: MUTED, 'font-size': '12px' }}>{group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'}</span>}
                >
                  <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '13px' }}>
                    <thead>
                      <tr style={{ color: MUTED, 'text-align': 'right' }}>
                        <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '0 0 7px 6px', 'border-bottom': `1px solid ${BORDER}` }}>Order ID</th>
                        <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Resource</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Type</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Active</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Price</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Available</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Remaining</th>
                        <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Total</th>
                        <th style={{ 'font-weight': 400, padding: '0 6px 7px 0', 'border-bottom': `1px solid ${BORDER}` }}>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={group.orders}>
                        {(o, i) => (
                          <tr style={{ background: rowBg(i()), 'text-align': 'right' }}>
                            <td style={{ 'text-align': 'left', color: MUTED, 'font-family': 'monospace', padding: '7px 8px 7px 6px' }}>{o._id}</td>
                            <td style={{ 'text-align': 'left', padding: '7px 0' }}>
                              <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); goToMarketResource(o.resourceType, group.shard) }}
                                style={{ display: 'inline-flex', 'align-items': 'center', gap: '8px', color: ACCENT, 'text-decoration': 'none' }}
                              >
                                <ResourceSwatch resourceType={o.resourceType} size={16} />
                                {resourceDisplayName(o.resourceType)}
                              </a>
                            </td>
                            <td style={{ color: o.type === 'sell' ? POS : NEG, padding: '7px 0' }}>{o.type === 'sell' ? 'Selling' : 'Buying'}</td>
                            <td style={{ color: o.active ? POS : NEG, padding: '7px 0' }}>{o.active ? 'Yes' : 'No'}</td>
                            <td style={{ color: TEXT, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>{fmtPrice(o.price)}</td>
                            <td style={{ color: TEXT, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>{fmtAmount(o.amount)}</td>
                            <td style={{ color: MUTED, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>{fmtAmount(o.remainingAmount)}</td>
                            <td style={{ color: MUTED, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>{fmtAmount(o.totalAmount)}</td>
                            <td style={{ padding: '7px 6px 7px 0' }}>
                              <Show when={o.roomName} fallback={<span style={{ color: MUTED }}>—</span>}>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); goToRoom(o.roomName!, group.shard) }}
                                  style={{ color: ACCENT, 'text-decoration': 'none' }}
                                >
                                  {o.roomName}
                                </a>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </Card>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </Show>
  )
}
