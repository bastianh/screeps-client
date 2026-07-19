import { Graphics } from 'pixi.js'
import type { RoomObject } from 'screeps-connectivity'
import { ST_ENERGY, ST_RESOURCE_OTHER, RESOURCE_COLORS } from '../colors.js'

// Store-band helpers: break a store into stacked colored resource bands.
export interface StoreBand { color: number; amount: number }

// Resources pinned to the bottom of the stack, in this order; others follow alphabetically.
export const BAND_ORDER = ['energy', 'power']

// Break a store into stacked, colored bands ordered bottom-up. `used` is the sum of
// the band amounts, so callers size the fill from a single total exactly as before;
// `dominant` is the highest-amount resource (null when empty), for single-tint structures.
export function getStoreBands(obj: RoomObject): { bands: StoreBand[]; used: number; capacity: number; dominant: string | null } {
  const capacity = typeof obj.storeCapacity === 'number' ? obj.storeCapacity : 0
  if (capacity === 0 || !obj.store || typeof obj.store !== 'object') {
    return { bands: [], used: 0, capacity: 0, dominant: null }
  }
  const store = obj.store as Record<string, unknown>
  const entries: Array<[string, number]> = []
  let dominant: string | null = null
  let dominantAmt = 0
  for (const k in store) {
    const v = store[k]
    if (typeof v === 'number' && v > 0) {
      entries.push([k, v])
      if (v > dominantAmt) { dominantAmt = v; dominant = k }
    }
  }
  entries.sort(([a], [b]) => {
    const ra = BAND_ORDER.indexOf(a), rb = BAND_ORDER.indexOf(b)
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || (a < b ? -1 : a > b ? 1 : 0)
  })
  let used = 0
  const bands = entries.map(([res, amount]): StoreBand => {
    used += amount
    return { color: RESOURCE_COLORS[res] ?? ST_RESOURCE_OTHER, amount }
  })
  return { bands, used, capacity, dominant }
}

// Stack resource bands bottom-up inside a box. `yBottom` is the box floor; `height` is the
// (animated) total fill height; bands sum to `used`. `margin` insets the whole envelope on
// all sides — bands stay contiguous within it. Falls back to a solid energy fill if bands
// are missing, matching the previous single-color behavior.
export function drawStoreBands(
  fill: Graphics,
  x: number, yBottom: number, width: number,
  height: number, bands: StoreBand[] | undefined, used: number,
  margin = 0,
): void {
  if (height <= 0 || used <= 0) return
  const innerX = x + margin
  const innerW = width - margin * 2
  const totalH = height - margin * 2
  const baseY = yBottom - margin
  if (totalH <= 0) return
  if (!bands || bands.length === 0) {
    fill.rect(innerX, baseY - totalH, innerW, totalH)
    fill.fill(ST_ENERGY)
    return
  }
  let y = baseY
  for (const band of bands) {
    const h = totalH * (band.amount / used)
    if (h > 0) {
      fill.rect(innerX, y - h, innerW, h)
      fill.fill(band.color)
    }
    y -= h
  }
}

// Bands differ if their colours/amounts differ — used to refresh a fill whose total is
// unchanged but whose composition (and so its colours) changed this tick.
export function bandsEqual(a: StoreBand[] | undefined, b: StoreBand[]): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < b.length; i++) {
    if (a[i]!.color !== b[i]!.color || a[i]!.amount !== b[i]!.amount) return false
  }
  return true
}
