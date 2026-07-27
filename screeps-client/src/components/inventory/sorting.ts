import type { ApiUserDecorationItem } from 'screeps-connectivity'

/** Display names for the decoration types, from the reference client's type pipe. */
export const DECORATION_TYPE_LABELS: Record<string, string> = {
  badge: 'Badge',
  creep: 'Creep',
  wallGraffiti: 'Graffiti',
  wallLandscape: 'Wall texture',
  floorLandscape: 'Floor texture',
  landscape: 'Landscape',
  metadata: 'Skin',
  object: 'Object',
}

// Rarity runs 1 (common) to 5 (legendary); index 0 covers a missing rarity.
const RARITY_COLORS = ['#c9d1d9', '#c9d1d9', '#58a6ff', '#a371f7', '#d29922', '#f0883e']

export function rarityColor(rarity?: number): string {
  return RARITY_COLORS[rarity ?? 0] ?? RARITY_COLORS[0]
}

export type SortKey = 'newest' | 'oldest' | 'rarest' | 'commonest' | 'room'

export const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'newest', label: 'New to old' },
  { key: 'oldest', label: 'Old to new' },
  { key: 'rarest', label: 'Rare to common' },
  { key: 'commonest', label: 'Common to rare' },
  { key: 'room', label: 'Rooms' },
]

function roomOf(item: ApiUserDecorationItem): string {
  return typeof item.active?.room === 'string' ? item.active.room : ''
}

/**
 * Sort a decoration list. Returns a new array; the input is left alone.
 *
 * Ties keep their original order — `Array.prototype.sort` is stable — so an
 * unrarified or unactivated batch stays in the order the server sent it.
 */
export function sortItems(items: readonly ApiUserDecorationItem[], key: SortKey): ApiUserDecorationItem[] {
  const out = [...items]
  switch (key) {
    case 'newest':
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'oldest':
      return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'rarest':
      return out.sort((a, b) => (b.decoration.rarity ?? 0) - (a.decoration.rarity ?? 0))
    case 'commonest':
      return out.sort((a, b) => (a.decoration.rarity ?? 0) - (b.decoration.rarity ?? 0))
    case 'room':
      return out.sort((a, b) => roomOf(b).localeCompare(roomOf(a)))
  }
}
