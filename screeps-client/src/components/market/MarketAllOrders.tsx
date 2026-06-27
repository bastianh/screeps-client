import { createSignal, createEffect, For, Show } from 'solid-js'
import { client } from '~/stores/clientStore.js'
import { goToMarketResource } from '~/stores/routeStore.js'
import { MARKET_RESOURCES, resourceDisplayName } from '~/data/resources.js'
import { ResourceSwatch } from './ResourceSwatch.js'
import { PANEL, PANEL_ALT, BORDER, TEXT, MUTED } from './theme.js'

// All-orders index: one card per tradeable resource with its open-order count,
// clicking through to that resource's order book. Mirrors the vanilla resource
// grid, which lists every resource (even those with zero orders).
export function MarketAllOrders(props: { shard: string | null }) {
  const [counts, setCounts] = createSignal<Record<string, number>>({})
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  // Guards against out-of-order responses when the shard changes mid-flight: a
  // stale response (id !== reqId) is ignored so the latest request always wins.
  let reqId = 0

  createEffect(() => {
    const shard = props.shard
    const c = client()
    if (!c) return
    const id = ++reqId
    setLoading(true)
    void c.http.game.market
      .ordersIndex(shard)
      .then((res) => {
        if (id !== reqId) return
        const map: Record<string, number> = {}
        for (const entry of res.list ?? []) map[entry._id] = entry.count
        setCounts(map)
        setError(null)
      })
      .catch((err) => { if (id === reqId) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (id === reqId) setLoading(false) })
  })

  return (
    <Show
      when={!error()}
      fallback={
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
          Couldn't load the market — this server may not support it.
        </div>
      }
    >
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', opacity: loading() ? 0.6 : 1 }}>
        <For each={MARKET_RESOURCES}>
          {(code) => {
            const count = () => counts()[code] ?? 0
            return (
              <button
                onClick={() => goToMarketResource(code, props.shard)}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  'border-radius': '6px',
                  border: `1px solid ${BORDER}`,
                  background: PANEL,
                  color: TEXT,
                  cursor: 'pointer',
                  'text-align': 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = PANEL_ALT)}
                onMouseLeave={(e) => (e.currentTarget.style.background = PANEL)}
              >
                <ResourceSwatch resourceType={code} size={20} />
                <span style={{ flex: 1, 'min-width': 0, overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                  {resourceDisplayName(code)}
                </span>
                <span style={{ color: count() > 0 ? TEXT : MUTED, 'font-size': '13px' }}>
                  {count()} {count() === 1 ? 'order' : 'orders'}
                </span>
              </button>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
