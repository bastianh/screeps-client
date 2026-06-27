import { createSignal, onMount, For, Show } from 'solid-js'
import { RefreshCw, ChevronsLeft, ChevronsRight } from 'lucide-solid'
import type { ApiUserMoneyHistoryResponse } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { PANEL, BORDER, TEXT, MUTED, POS, NEG, fmtPrice } from './theme.js'
import { Card, rowBg } from './ui.js'
import { isMultiShard } from './shardState.js'

type Entry = ApiUserMoneyHistoryResponse['list'][number]

// Human-readable description for a credit-ledger entry. Market transactions get
// explicit copy; anything else falls back to its dotted type made readable.
function describe(entry: Entry): string {
  switch (entry.type) {
    case 'market.buy':
      return 'Resources bought via market order'
    case 'market.sell':
      return 'Resources sold via market order'
    case 'market.fee':
      return 'Market fee'
    default:
      return entry.type.replace(/[._]/g, ' ')
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

// Credit history — the account money ledger, paginated newest-first. Market
// buys/sells/fees are the headline rows but all credit movement is listed.
export function MarketHistory() {
  const [entries, setEntries] = createSignal<Entry[]>([])
  const [page, setPage] = createSignal(0)
  const [hasMore, setHasMore] = createSignal(false)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const load = (p: number): void => {
    const c = client()
    if (!c) return
    setLoading(true)
    void c.http.user
      .moneyHistory(p)
      .then((res) => {
        setEntries(res.list ?? [])
        setPage(res.page ?? p)
        setHasMore(res.hasMore ?? false)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  onMount(() => load(0))

  return (
    <Show
      when={!error()}
      fallback={
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
          Couldn't load your history.
        </div>
      }
    >
      <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-bottom': '12px' }}>
        <button
          onClick={() => load(page())}
          title="Refresh"
          style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '6px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <Show
        when={entries().length}
        fallback={
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
            Your market history is empty.
          </div>
        }
      >
        <Card title="Credit history">
          <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '13px', opacity: loading() ? 0.6 : 1 }}>
            <thead>
              <tr style={{ color: MUTED, 'text-align': 'right' }}>
                <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '0 0 7px 6px', 'border-bottom': `1px solid ${BORDER}` }}>Date</th>
                <Show when={isMultiShard()}>
                  <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Shard</th>
                </Show>
                <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Tick</th>
                <th style={{ 'text-align': 'left', 'font-weight': 400, padding: '0 12px 7px', 'border-bottom': `1px solid ${BORDER}` }}>Description</th>
                <th style={{ 'font-weight': 400, padding: '0 0 7px', 'border-bottom': `1px solid ${BORDER}` }}>Change</th>
                <th style={{ 'font-weight': 400, padding: '0 6px 7px 0', 'border-bottom': `1px solid ${BORDER}` }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {(e, i) => (
                  <tr style={{ background: rowBg(i()), 'text-align': 'right' }}>
                    <td style={{ 'text-align': 'left', color: MUTED, padding: '7px 0 7px 6px' }}>{fmtDate(e.date)}</td>
                    <Show when={isMultiShard()}>
                      <td style={{ 'text-align': 'left', color: MUTED, padding: '7px 0' }}>{e.shard ?? '—'}</td>
                    </Show>
                    <td style={{ color: MUTED, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>{e.tick}</td>
                    <td style={{ 'text-align': 'left', color: TEXT, padding: '7px 12px' }}>{describe(e)}</td>
                    <td style={{ color: e.change > 0 ? POS : e.change < 0 ? NEG : MUTED, 'font-variant-numeric': 'tabular-nums', padding: '7px 0' }}>
                      {e.change > 0 ? '+' : ''}{fmtPrice(e.change)}
                    </td>
                    <td style={{ color: TEXT, 'font-variant-numeric': 'tabular-nums', padding: '7px 6px 7px 0' }}>{fmtPrice(e.balance)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-top': '16px' }}>
          <Show when={page() > 0} fallback={<span />}>
            <button
              onClick={() => load(page() - 1)}
              style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '6px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
            >
              <ChevronsLeft size={14} /> Newer
            </button>
          </Show>
          <Show when={hasMore()}>
            <button
              onClick={() => load(page() + 1)}
              style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '6px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
            >
              Older <ChevronsRight size={14} />
            </button>
          </Show>
        </div>
      </Show>
    </Show>
  )
}
