import { For, Show } from 'solid-js'
import { gameTime } from '~/stores/clientStore.js'
import { HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { SKIP_FIELDS, NUMERIC_FIELDS, kvCell, kvGrid, camelToLabel, formatValue } from './shared.js'

export function DefaultDetails(props: { item: SelectedObject }) {
  const hits = () => typeof (props.item.raw as Record<string, unknown>).hits === 'number' ? ((props.item.raw as Record<string, unknown>).hits as number) : null
  const hitsMax = () => typeof (props.item.raw as Record<string, unknown>).hitsMax === 'number' ? ((props.item.raw as Record<string, unknown>).hitsMax as number) : null
  const fields = () => {
    const raw = props.item.raw as Record<string, unknown>
    const pairs: { key: string; label: string; value: string }[] = []
    for (const k in raw) {
      if (SKIP_FIELDS.has(k)) continue

      const v = raw[k]
      let finalValue = formatValue(v)

      if (k === 'notifyWhenAttacked' && v === false) continue
      if (k === 'off' && v === false) continue

      if (k === 'hits' && typeof raw.hitsMax === 'number') {
        finalValue = `${v} / ${raw.hitsMax}`
      }

      if (k === 'energy' && typeof raw.energyCapacity === 'number') {
        finalValue = `${v} / ${raw.energyCapacity}`
      }

      if (k === 'nextDecayTime' && typeof v === 'number') {
        const gt = gameTime()
        if (gt !== null) finalValue = String(v - gt)
      }

      if (k === 'nextRegenerationTime' && typeof v === 'number') {
        const gt = gameTime()
        if (gt !== null) finalValue = String(v - gt)
      }


      if (finalValue !== null) pairs.push({ key: k, label: camelToLabel(k), value: finalValue })
    }
    pairs.sort((a, b) => {
      const aP = NUMERIC_FIELDS.has(a.key) ? 0 : 1
      const bP = NUMERIC_FIELDS.has(b.key) ? 0 : 1
      return aP - bP
    })
    return pairs
  }

  return (
    <>
      <Show when={fields().length > 0}>
        <div style={kvGrid}>
          <For each={fields()}>
            {(field) => (
              <>
                <div style={kvCell(true)}>{field.label}</div>
                <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{field.value}</div>
              </>
            )}
          </For>
        </div>
      </Show>
      <HitsBar hits={hits()} max={hitsMax()} />
    </>
  )
}
