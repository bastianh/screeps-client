import { Switch, Match, Show, For, type JSX } from 'solid-js'
import { X } from 'lucide-solid'
import { OverlayPage } from '~/components/OverlayPage.js'
import {
  goToGame,
  goToMarket,
  goToMarketResource,
  goToMarketMyOrders,
  goToMarketHistory,
  marketView,
  marketResourceType,
} from '~/stores/routeStore.js'
import { PANEL, BORDER, TEXT, MUTED, ACCENT } from './theme.js'
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
    <OverlayPage>
        {/* Section header */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '8px' }}>
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
          <button
            onClick={goToGame}
            title="Close"
            style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
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
    </OverlayPage>
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
