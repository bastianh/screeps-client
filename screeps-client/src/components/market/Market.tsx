import { Switch, Match, Show, For, type JSX } from 'solid-js'
import { ChevronLeft } from 'lucide-solid'
import {
  goToGame,
  goToMarket,
  goToMarketResource,
  goToMarketMyOrders,
  goToMarketHistory,
  marketView,
  marketResourceType,
} from '~/stores/routeStore.js'
import { BG, PANEL, BORDER, TEXT, MUTED, ACCENT } from './theme.js'
import { marketShards, effectiveMarketShard, isMultiShard } from './shardState.js'
import { MarketAllOrders } from './MarketAllOrders.js'
import { MarketResource } from './MarketResource.js'
import { MarketMyOrders } from './MarketMyOrders.js'
import { MarketHistory } from './MarketHistory.js'

// Shared data + page frame for the Market section. Read-only browser over the
// in-game market (matching vanilla): resource index, per-resource order books,
// your own orders, and your credit history. Order creation/cancellation is left
// to the in-game Market API, exactly as the official client does.
export function Market() {
  const onAllOrders = () => marketView() === 'all-orders' || marketView() === 'resource'

  const onShardChange = (shard: string): void => {
    if (marketView() === 'resource' && marketResourceType()) goToMarketResource(marketResourceType()!, shard)
    else goToMarket(shard)
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: BG, color: TEXT }}>
      <div style={{ 'max-width': '1040px', margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '8px' }}>
          <button
            onClick={goToGame}
            title="Back to the world"
            style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '7px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
          >
            <ChevronLeft size={16} /> World
          </button>
          <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>Market</h1>
          <div style={{ flex: 1 }} />
          <Show when={onAllOrders() && isMultiShard()}>
            <label style={{ display: 'flex', 'align-items': 'center', gap: '8px', color: MUTED, 'font-size': '13px' }}>
              Shard
              <select
                value={effectiveMarketShard() ?? ''}
                onChange={(e) => onShardChange(e.currentTarget.value)}
                style={{ padding: '6px 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: PANEL, color: TEXT, cursor: 'pointer' }}
              >
                <For each={marketShards()}>{(s) => <option value={s}>{s}</option>}</For>
              </select>
            </label>
          </Show>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '20px' }}>
          <Tab label="All orders" active={onAllOrders()} onClick={() => goToMarket(effectiveMarketShard())} />
          <Tab label="My orders" active={marketView() === 'my-orders'} onClick={goToMarketMyOrders} />
          <Tab label="History" active={marketView() === 'history'} onClick={goToMarketHistory} />
        </div>

        <Switch>
          <Match when={marketView() === 'resource'}>
            <MarketResource resourceType={marketResourceType()} shard={effectiveMarketShard()} />
          </Match>
          <Match when={marketView() === 'my-orders'}>
            <MarketMyOrders />
          </Match>
          <Match when={marketView() === 'history'}>
            <MarketHistory />
          </Match>
          <Match when={marketView() === 'all-orders'}>
            <MarketAllOrders shard={effectiveMarketShard()} />
          </Match>
        </Switch>
      </div>
    </div>
  )
}

function Tab(props: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={() => props.onClick()}
      style={{
        padding: '8px 16px',
        border: 'none',
        'border-bottom': `2px solid ${props.active ? ACCENT : 'transparent'}`,
        background: 'transparent',
        color: props.active ? TEXT : MUTED,
        'font-size': '14px',
        'font-weight': props.active ? 600 : 400,
        cursor: 'pointer',
        'margin-bottom': '-1px',
      }}
    >
      {props.label}
    </button>
  )
}
