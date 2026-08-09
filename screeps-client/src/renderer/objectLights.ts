import type { RoomObject } from 'screeps-connectivity'
import type { Glow } from './LightingLayer.js'
import { DEPOSIT_COLORS, RESOURCE_COLORS, ST_RESOURCE_OTHER } from './colors.js'

/**
 * What each object contributes to the room's light map.
 *
 * Transcribed from the official client's object metadata (`renderer-metadata.js`), where
 * every pool is a `glow` sprite on the `lighting` layer with a `width` in reference units
 * (100 per tile) and an `alpha`. Sizes and alphas are kept verbatim so a room reads at the
 * reference's brightness — a single uniform pool per object, which is what this replaced,
 * gave every extension a spawn-sized halo at full alpha and washed whole bases out.
 *
 * The reference drives some pools from a shaped texture rather than the round glow (a
 * creep's body mask, a deposit's icon, a dropped pile's resource circle); those become a
 * glow of the same footprint here, since we ship none of those assets.
 *
 * Types absent from this switch — roads, walls, ramparts, construction sites, flags,
 * extractors — contribute nothing, exactly as in the metadata.
 */

/** Engine-assigned NPC user ids; their creeps light like the reference's `isNpc` branch. */
const USER_INVADER = '2'
const USER_SOURCE_KEEPER = '3'

/** Radius the reference gives a full pile of dropped energy, in reference units. */
const DROPPED_ENERGY_RADIUS = 30
/** Store the reference's resource circle scales that radius against. */
const DROPPED_ENERGY_CAPACITY = 1250

const NONE: readonly Glow[] = []

export function objectGlows(obj: RoomObject): readonly Glow[] {
  switch (obj.type) {
    case 'spawn':
      return energyOf(obj) > 0 ? [{ size: 600, alpha: 0.5 }, { size: 100, alpha: 1 }]
        : [{ size: 600, alpha: 0.5 }]

    case 'extension': {
      if (energyOf(obj) <= 0) return NONE
      // The halo grows with the extension's tier, as its sprite does.
      const capacity = energyCapacityOf(obj)
      const halo = capacity >= 200 ? 250 : capacity >= 100 ? 220 : 200
      return [{ size: halo, alpha: 0.7 }, { size: 100, alpha: 1 }]
    }

    case 'tower':
      return energyOf(obj) > 0 ? [{ size: 600, alpha: 0.5 }, { size: 100, alpha: 1 }]
        : [{ size: 600, alpha: 0.5 }]

    case 'link':
      return energyOf(obj) > 0 ? [{ size: 400, alpha: 0.5 }, { size: 100, alpha: 1 }] : NONE

    case 'storage':
    case 'terminal':
      return storeTotal(obj) > 0 ? [{ size: 800, alpha: 0.5 }, { size: 200, alpha: 1 }]
        : [{ size: 800, alpha: 0.5 }]

    case 'factory':
      return storeTotal(obj) > 0 ? [{ size: 800, alpha: 0.5 }, { size: 200, alpha: 1 }]
        : [{ size: 800, alpha: 0.5 }]

    case 'lab':
      // Only a loaded reaction lab glows; energy alone leaves it dark.
      return storeTotal(obj) - energyOf(obj) > 0
        ? [{ size: 500, alpha: 0.3 }, { size: 150, alpha: 1 }] : NONE

    case 'container':
      return storeTotal(obj) > 0 ? [{ size: 100, alpha: 1 }] : NONE

    case 'nuker':
      return [{ size: 800, alpha: 0.5 }, { size: 100, alpha: 1 }]

    case 'observer':
      return [{ size: 800, alpha: 0.5 }]

    case 'powerSpawn':
      // The reference's halo is the raw 256² glow texture at scale 1, pulsing to twice
      // that while power is processed; we hold it at rest.
      return [{ size: 256, alpha: 0.5 }, { size: 150, alpha: 1 }]

    case 'controller':
      return obj.user ? [{ size: 1200, alpha: 0.5 }, { size: 500, alpha: 1 }]
        : [{ size: 1200, alpha: 0.5 }]

    case 'source':
      return energyOf(obj) > 0
        ? [{ size: 800, alpha: 0.5, tint: 0xffff50 }, { size: 150, alpha: 1 }]
        : [{ size: 800, alpha: 0.5, tint: 0xffff50 }]

    case 'mineral':
      return [{ size: 700, alpha: 0.7, tint: mineralColor(obj) }, { size: 200, alpha: 1 }]

    case 'deposit':
      return [{ size: 700, alpha: 1, tint: mineralColor(obj) }, { size: 160, alpha: 1 }]

    case 'keeperLair':
      return [{ size: 800, alpha: 0.5, tint: 0xff0000 }, { size: 150, alpha: 1 }]

    case 'powerBank':
      return [{ size: 800, alpha: 1, tint: 0xff8080 }]

    case 'invaderCore':
      return [{ size: 800, alpha: 1, tint: 0xff8080 }, { size: 100, alpha: 1 }]

    case 'nuke':
      return [{ size: 700, alpha: 1, tint: 0xff4444 }]

    case 'portal':
      return [{ size: 700, alpha: 0.7, tint: 0x9999ff }, { size: 150, alpha: 1, tint: 0x7777ff }]

    case 'tombstone':
    case 'ruin':
      return [{ size: 100, alpha: 1 }]

    case 'creep': {
      // A creep still in its spawn is drawn by the spawn, and lights nothing of its own.
      if (obj.spawning) return NONE
      const npc = obj.user === USER_INVADER || obj.user === USER_SOURCE_KEEPER
      return [{ size: 400, alpha: 0.2 }, { size: 100, alpha: npc ? 0.5 : 1 }]
    }

    case 'powerCreep':
      return [{ size: 400, alpha: 1, tint: 0xff5555 }, { size: 180, alpha: 1 }]

    case 'energy': {
      // A dropped pile lights only as far as it is drawn: the reference puts its
      // resource circle straight into the light map, sized by how much is lying there.
      const amount = typeof obj.energy === 'number' ? obj.energy : 0
      if (amount <= 0) return NONE
      const radius = DROPPED_ENERGY_RADIUS * Math.min(1, amount / DROPPED_ENERGY_CAPACITY)
      return [{ size: radius * 2, alpha: 1 }]
    }

    default:
      return NONE
  }
}

function storeOf(obj: RoomObject): Record<string, unknown> | null {
  return obj.store && typeof obj.store === 'object' ? obj.store as Record<string, unknown> : null
}

function energyOf(obj: RoomObject): number {
  if (typeof obj.energy === 'number') return obj.energy
  const store = storeOf(obj)
  const energy = store?.energy
  return typeof energy === 'number' ? energy : 0
}

function energyCapacityOf(obj: RoomObject): number {
  if (typeof obj.energyCapacity === 'number') return obj.energyCapacity
  if (typeof obj.storeCapacity === 'number') return obj.storeCapacity
  if (obj.storeCapacityResource && typeof obj.storeCapacityResource === 'object') {
    const capacity = (obj.storeCapacityResource as Record<string, unknown>).energy
    if (typeof capacity === 'number') return capacity
  }
  return 0
}

function storeTotal(obj: RoomObject): number {
  const store = storeOf(obj)
  if (!store) return energyOf(obj)
  let total = 0
  for (const resource in store) {
    const amount = store[resource]
    if (typeof amount === 'number' && amount > 0) total += amount
  }
  return total
}

// Both pools the reference tints by the deposit's own colour: a mineral by its resource,
// a deposit by its commodity.
function mineralColor(obj: RoomObject): number {
  if (typeof obj.mineralType === 'string') return RESOURCE_COLORS[obj.mineralType] ?? ST_RESOURCE_OTHER
  if (typeof obj.depositType === 'string') return DEPOSIT_COLORS[obj.depositType] ?? ST_RESOURCE_OTHER
  return ST_RESOURCE_OTHER
}
