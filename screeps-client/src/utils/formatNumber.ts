// Shared number formatting for the HTML UI.

// Compact number formatting for stat bar labels: thousands collapse to a "K"
// suffix with one decimal, millions to an "M" suffix with two (1234 → "1.2K",
// 1234567 → "1.23M"). Small values print verbatim.
export function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${parseFloat(m.toFixed(2))}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return `${parseFloat(k.toFixed(1))}K`
  }
  return String(n)
}

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
