import type {
  ApiDecorationProp,
  ApiRoomDecorationActive,
  ApiRoomDecorationDef,
  ApiUserDecorationItem,
  BadgeSymbol,
} from 'screeps-connectivity'

// Pure logic behind placing a decoration: seeding its editable state, grouping the
// properties the editor offers, and working out which rooms are already taken.

/**
 * Keys that sit on `decoration.props` as plain scalars rather than property descriptors.
 * They describe how the position editor may resize the decoration, not something the
 * user edits directly.
 */
const LAYOUT_KEYS = new Set(['proportional', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'])

/** Target shard and room ride along with the prop values on every activation. */
const INHERITED = ['shard', 'room'] as const

/** The property descriptors of a decoration, layout constraints filtered out. */
export function propEntries(decoration: ApiRoomDecorationDef): Array<[string, ApiDecorationProp]> {
  const props = decoration.props
  if (!props) return []
  const out: Array<[string, ApiDecorationProp]> = []
  for (const [name, value] of Object.entries(props)) {
    if (LAYOUT_KEYS.has(name)) continue
    if (value == null || typeof value !== 'object') continue
    out.push([name, value])
  }
  return out
}

/**
 * Build the state to activate a decoration with.
 *
 * Every property in the schema gets its default, except where the decoration is already
 * active and still has a value for it — editing a placed decoration must not silently
 * reset the untouched properties. Values whose property has since left the schema are
 * dropped, which is what the reference client does.
 */
export function buildActiveState(
  decoration: ApiRoomDecorationDef,
  existing: ApiRoomDecorationActive | null,
): ApiRoomDecorationActive {
  const out: ApiRoomDecorationActive = {}

  for (const [name, descriptor] of propEntries(decoration)) {
    out[name] = existing != null && existing[name] !== undefined ? existing[name] : descriptor.default
  }
  for (const key of INHERITED) {
    if (existing?.[key] != null) out[key] = existing[key]
  }

  return out
}

/** Creep and badge decorations apply account-wide, so they have no target room. */
export function needsRoom(type: string): boolean {
  return type !== 'creep' && type !== 'badge'
}

/**
 * The badge symbols the account may wear: one per badge decoration that is currently
 * active. The badge editor offers these beside the 24 numbered shapes; the server takes
 * the paths from the matching grant, so an unworn symbol cannot be saved.
 */
export function grantedBadgeSymbols(items: readonly ApiUserDecorationItem[]): BadgeSymbol[] {
  const out: BadgeSymbol[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.decoration.type !== 'badge' || item.active == null) continue
    const symbol = item.decoration.badge
    if (symbol == null || symbol.path1 === '') continue
    const key = `${symbol.path1}\n${symbol.path2}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path1: symbol.path1, path2: symbol.path2 })
  }
  return out
}

/**
 * Decoration types that cannot share a room with the given one.
 *
 * `landscape` is the combined type, so it blocks — and is blocked by — both halves,
 * while a wall and a floor landscape happily coexist. Skins and object overlays only
 * clash with their own type. Graffiti is unrestricted: a room may carry any number.
 */
const COLLISIONS: Record<string, readonly string[]> = {
  landscape: ['landscape', 'wallLandscape', 'floorLandscape'],
  wallLandscape: ['landscape', 'wallLandscape'],
  floorLandscape: ['landscape', 'floorLandscape'],
  metadata: ['metadata'],
  object: ['object'],
}

export function collidingTypes(type: string): readonly string[] {
  return COLLISIONS[type] ?? []
}

/** Key a room by shard so the same room name on two shards stays distinct. */
export function roomKey(shard: string | null | undefined, room: string): string {
  return `${shard ?? ''}/${room}`
}

/**
 * Find the picker entry for a room, preferring an exact shard match.
 *
 * The fallback to the name alone covers servers that disagree with themselves about
 * shards: a single-shard server reports no shard for the open room while still listing
 * the account's rooms under a shard name, and the two would never match otherwise.
 */
export function findRoomOption<T extends { room: string; shard: string | null }>(
  options: readonly T[],
  room: string,
  shard: string | null,
): T | undefined {
  return options.find(o => o.room === room && o.shard === shard)
    ?? options.find(o => o.room === room)
}

/**
 * Rooms that already hold a decoration clashing with `type`, keyed by {@link roomKey}.
 * The item being edited is skipped — re-placing it in its own room is not a conflict.
 */
export function blockedRooms(
  items: readonly ApiUserDecorationItem[],
  type: string,
  editingId?: string,
): Map<string, ApiUserDecorationItem> {
  const clashes = new Set(collidingTypes(type))
  const out = new Map<string, ApiUserDecorationItem>()
  if (clashes.size === 0) return out

  for (const item of items) {
    if (item._id === editingId) continue
    if (!clashes.has(item.decoration.type)) continue
    const room = item.active?.room
    if (typeof room !== 'string' || room === '') continue
    const shard = typeof item.active?.shard === 'string' ? item.active.shard : null
    const key = roomKey(shard, room)
    if (!out.has(key)) out.set(key, item)
  }
  return out
}

export interface EditorGroups {
  /** Free-text properties. */
  inputs: Array<[string, ApiDecorationProp]>
  colors: Array<[string, ApiDecorationProp]>
  /** Checkboxes. */
  displays: Array<[string, ApiDecorationProp]>
  ranges: Array<[string, ApiDecorationProp]>
  /** The animation picker, if this decoration has one. */
  animation: [string, ApiDecorationProp] | null
}

/** Preset animation names offered for the `Animation` property. */
export const ANIMATION_OPTIONS = ['', 'slow', 'fast', 'blink', 'neon', 'flash']

function isAnimation(descriptor: ApiDecorationProp): boolean {
  return descriptor.label === 'Animation'
}

/**
 * Split the editable properties into the blocks the editor renders.
 *
 * Read-only properties are part of the active state but never offered. For creep and
 * graffiti decorations only the colours actually referenced by a graphic are shown —
 * the schema of those types carries colour props that no graphic binds to, and offering
 * them would be offering a control that changes nothing.
 */
export function editorGroups(decoration: ApiRoomDecorationDef): EditorGroups {
  const groups: EditorGroups = { inputs: [], colors: [], displays: [], ranges: [], animation: null }
  const bound = new Set((decoration.graphics ?? []).map(g => g.color).filter(c => c != null))
  const restrictColors = decoration.type === 'creep' || decoration.type === 'wallGraffiti'

  for (const entry of propEntries(decoration)) {
    const [name, descriptor] = entry
    if (descriptor.readonly === true) continue

    if (isAnimation(descriptor)) {
      groups.animation ??= entry
      continue
    }
    switch (descriptor.type) {
      case 'string':
        groups.inputs.push(entry)
        break
      case 'color':
        if (!restrictColors || bound.has(name)) groups.colors.push(entry)
        break
      case 'display':
        groups.displays.push(entry)
        break
      case 'range':
        groups.ranges.push(entry)
        break
    }
  }

  return groups
}

/** List-valued properties travel as one `!SEP!`-joined string, not an array. */
export const LIST_SEPARATOR = '!SEP!'

export function splitList(value: unknown): string[] {
  if (typeof value !== 'string' || value === '') return []
  return value.split(LIST_SEPARATOR).filter(s => s !== '')
}

export function joinList(values: readonly string[]): string {
  return values.filter(s => s !== '').join(LIST_SEPARATOR)
}
