import { For } from 'solid-js'
import type { ApiUserOverviewTotals, ApiUserStatsResponse } from 'screeps-connectivity'
import { formatStat } from '~/utils/formatStat.js'

// Lifetime/interval stat tiles shared by the Overview (self) and Profile
// (public) account pages — same seven metrics, same palette as vanilla.
const PANEL = '#161b22'
const BORDER = '#30363d'
const MUTED = '#8b949e'

export const STAT_TILES: Array<{ key: keyof ApiUserOverviewTotals; l1: string; l2: string; color: string }> = [
  { key: 'energyControl', l1: 'Control', l2: 'points', color: '#A7FFEB' },
  { key: 'energyHarvested', l1: 'Energy', l2: 'harvested', color: '#ffe56d' },
  { key: 'energyConstruction', l1: 'Energy', l2: 'on construct', color: '#eeeeee' },
  { key: 'energyCreeps', l1: 'Energy', l2: 'on creeps', color: '#eeeeee' },
  { key: 'creepsProduced', l1: 'Creeps', l2: 'produced', color: '#65fd62' },
  { key: 'creepsLost', l1: 'Creeps', l2: 'lost', color: '#f96e76' },
  { key: 'powerProcessed', l1: 'Power', l2: 'processed', color: '#E04040' },
]

export function StatTile(props: { l1: string; l2: string; color: string; value: number | undefined }) {
  return (
    <div style={{ flex: 1, 'min-width': '0', background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '6px', padding: '14px 8px 12px', 'text-align': 'center' }}>
      <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'line-height': '1.3' }}>
        {props.l1}<br />{props.l2}
      </div>
      <div style={{ color: props.color, 'font-size': '28px', 'font-weight': 300, 'margin-top': '8px' }}>{formatStat(props.value)}</div>
    </div>
  )
}

// Normalize /api/user/stats into the totals shape the tiles consume. Used for
// public profiles, where the self-only /api/user/overview totals aren't
// available. Servers return each metric either as per-tick buckets (sum them
// over the interval) or as a single pre-summed total — handle both.
export function totalsFromStats(res: ApiUserStatsResponse | null | undefined): ApiUserOverviewTotals | null {
  const stats = res?.stats
  if (!stats) return null
  const totals: Partial<ApiUserOverviewTotals> = {}
  for (const t of STAT_TILES) {
    const metric = stats[t.key]
    if (metric == null) continue
    totals[t.key] = Array.isArray(metric)
      ? metric.reduce((sum, b) => sum + (b?.value ?? 0), 0)
      : Number(metric) || 0
  }
  return totals as ApiUserOverviewTotals
}

// The full seven-tile row, fed by an overview/stats totals object.
export function StatTileRow(props: { totals: ApiUserOverviewTotals | null | undefined }) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <For each={STAT_TILES}>
        {(t) => <StatTile l1={t.l1} l2={t.l2} color={t.color} value={props.totals?.[t.key]} />}
      </For>
    </div>
  )
}
