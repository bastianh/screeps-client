import { For, Show } from 'solid-js'

export function StoreDetails(props: { store?: Record<string, number>; capacity?: number | null }) {
  const items = () => {
    const storeObj = props.store || {}
    const arr: [string, number][] = []
    for (const res in storeObj) {
      arr.push([res, storeObj[res]])
    }
    return arr
  }

  const currentTotal = () => {
    const storeObj = props.store || {}
    let total = 0
    for (const res in storeObj) total += storeObj[res]
    return total
  }

  return (
    <Show when={items().length > 0}>
      <div style={{ background: '#21262d', 'border-top': '1px solid #30363d', 'font-size': '10px' }}>
        <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600, display: 'flex', 'justify-content': 'space-between' }}>
          <span>Store Contents</span>
          <Show when={props.capacity != null}>
            <span style={{ 'font-variant-numeric': 'tabular-nums', 'font-weight': 400 }}>
              {currentTotal()} / {props.capacity}
            </span>
          </Show>
        </div>
        <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '1px', background: '#21262d' }}>
          <For each={items()}>
            {([res, amount]) => (
              <>
                <div style={{ padding: '3px 8px', background: '#0d1117', color: '#8b949e' }}>
                  {res}
                </div>
                <div style={{ padding: '3px 8px', background: '#0d1117', color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
                  {amount}
                </div>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
