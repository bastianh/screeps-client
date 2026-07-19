import { Show } from 'solid-js'
import { formatLargeNumber } from '~/utils/formatNumber.js'

/**
 * A thin horizontal fill bar with a label + `value / max (pct%)` readout.
 * Shared by the RCL, store-fill and hits panels in the selection view so they
 * all render identically. (Named MeterBar to stay distinct from StatsBar, the
 * CPU/memory status strip.)
 */
export function MeterBar(props: {
  label: string
  value: number
  max: number
  color: string
  format?: (n: number) => string
}) {
  const pct = () => (props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0)
  const fmt = (n: number) => (props.format ? props.format(n) : String(n))

  return (
    <div style={{ padding: '5px 8px', background: '#0d1117', 'border-top': '1px solid #21262d' }}>
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '10px', 'margin-bottom': '4px' }}>
        <span style={{ color: '#8b949e' }}>{props.label}</span>
        <span style={{ color: '#c9d1d9', 'font-variant-numeric': 'tabular-nums' }}>
          {fmt(props.value)} / {fmt(props.max)} ({pct().toFixed(1)}%)
        </span>
      </div>
      <div style={{ height: '5px', background: '#21262d', 'border-radius': '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct()}%`, background: props.color, 'border-radius': '3px' }} />
      </div>
    </div>
  )
}

/** Green when healthy, amber when hurt, red when critical — matches the palette used elsewhere. */
export function hitsColor(ratio: number): string {
  if (ratio > 0.66) return '#3fb950'
  if (ratio > 0.33) return '#e3b341'
  return '#f85149'
}

/**
 * A damage-graded hits bar. Renders nothing at full health (or when hits data is
 * absent) so undamaged objects stay uncluttered — the plain numeric Hits row still
 * shows the exact values.
 */
export function HitsBar(props: { hits: number | null; max: number | null }) {
  const damaged = () => props.hits !== null && props.max !== null && props.max > 0 && props.hits < props.max
  return (
    <Show when={damaged()}>
      <MeterBar
        label="Hits"
        value={props.hits!}
        max={props.max!}
        color={hitsColor(props.hits! / props.max!)}
        format={formatLargeNumber}
      />
    </Show>
  )
}
