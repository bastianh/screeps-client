// GitHub-dark chrome shared across the Market section (matches Overview/Dashboard).
export const BG = '#0d1117'
export const PANEL = '#161b22'
export const PANEL_ALT = '#1c2129'
export const BORDER = '#30363d'
export const TEXT = '#c9d1d9'
export const MUTED = '#8b949e'
export const ACCENT = '#58a6ff'
export const POS = '#3fb950' // sell side / positive credit change
export const NEG = '#f85149' // buy side / negative credit change

// Amounts are whole numbers with thousands separators; prices show 3 decimals
// (the market's credit precision). Both mirror the in-game market formatting.
export function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('en-US')
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
