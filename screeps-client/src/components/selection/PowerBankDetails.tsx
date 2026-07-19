import { Show } from 'solid-js'
import { gameTime } from '~/stores/clientStore.js'
import { HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { kvCell, kvGrid } from './shared.js'

export function PowerBankDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const decayCountdown = () => {
    const dt = raw().decayTime
    if (typeof dt !== 'number') return null
    const gt = gameTime()
    return gt !== null ? Math.max(0, dt - gt) : dt
  }

  const power = () => {
    // Old-format servers: direct obj.power; new-format: store.power
    const direct = raw().power
    if (typeof direct === 'number') return direct
    const store = raw().store as Record<string, number> | undefined
    return typeof store?.power === 'number' ? store.power : null
  }

  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null

  return (
    <div>
    <div style={kvGrid}>
      <Show when={power() !== null}>
        <>
          <div style={kvCell(true)}>Power</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{power()}</div>
        </>
      </Show>
      <Show when={hits() !== null}>
        <>
          <div style={kvCell(true)}>Hits</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
            {hits()} {hitsMax() !== null ? `/ ${hitsMax()}` : ''}
          </div>
        </>
      </Show>
      <Show when={decayCountdown() !== null}>
        <>
          <div style={kvCell(true)}>Decays in</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{decayCountdown()}</div>
        </>
      </Show>
    </div>
      <HitsBar hits={hits()} max={hitsMax()} />
    </div>
  )
}
