import { Show } from 'solid-js'
import { formatLargeNumber } from '~/utils/formatNumber.js'
import { MeterBar, HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { StoreDetails } from './StoreDetails.js'
import { kvCell, kvGrid } from './shared.js'

export function StoreStructureDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  const store = () => raw().store as Record<string, number> | undefined
  const capacity = () => {
    if (typeof raw().storeCapacity === 'number') return raw().storeCapacity as number
    const res = raw().storeCapacityResource as Record<string, number> | undefined
    if (res) {
      let total = 0
      for (const k in res) total += res[k]
      return total
    }
    return null
  }

  const total = () => {
    const s = store()
    if (!s) return 0
    let t = 0
    for (const k in s) t += s[k]
    return t
  }

  return (
    <div>
      <Show when={hits() !== null && hitsMax() !== null}>
        <div style={kvGrid}>
          <div style={kvCell(true)}>Hits</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
        </div>
      </Show>

      <HitsBar hits={hits()} max={hitsMax()} />

      <Show when={capacity() !== null}>
        <MeterBar label="Fill" value={total()} max={capacity()!} color="#ffe87b" format={formatLargeNumber} />
      </Show>

      <StoreDetails store={store()} capacity={null} />
    </div>
  )
}
