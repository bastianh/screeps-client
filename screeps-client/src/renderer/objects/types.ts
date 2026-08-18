import { Container, Graphics, Text, Sprite } from 'pixi.js'
import type { RoomObject, Badge } from 'screeps-connectivity'
import type { BadgeTextureCache } from '../BadgeTextureCache.js'
import type { CustomObjectVisual } from '../custom/CustomObjectVisual.js'
import { type StoreBand } from './store.js'

// Shared types for the per-object renderer modules.
export type ContainerWithTarget = Container & {
  __targetX?: number
  __targetY?: number
  __moveStartX?: number
  __moveStartY?: number
  __moveStartT?: number
  __moveDur?: number
  __tileX?: number
  __tileY?: number
  __angle?: number
  __bodyContainer?: Container
  __sayBubble?: Container
  __sayMessage?: string
  __creepFillGraphics?: Graphics
  __creepUsed?: number
  __creepCapacity?: number
  __nameLabel?: Text
  __creepBorderG?: Graphics
  __creepBadgeSprite?: Sprite
  __creepForeignMark?: Graphics
  __towerFillGraphics?: Graphics
  __towerEnergy?: number
  __towerCapacity?: number
  __towerFillRect?: { x: number; yMin: number; width: number; heightMax: number; rx: number; ry: number }
  __linkFillGraphics?: Graphics
  __linkEnergy?: number
  __linkCapacity?: number
  __storageFillG?: Graphics
  __storageBands?: StoreBand[]
  __storageUsed?: number
  __storageCapacity?: number
  __containerFillG?: Graphics
  __containerBands?: StoreBand[]
  __containerUsed?: number
  __containerCapacity?: number
  __terminalFillG?: Graphics
  __terminalFillColor?: number
  __terminalDominant?: string
  __terminalUsed?: number
  __terminalCapacity?: number
  __tombstoneDeath?: number
  __tombstoneDecayTime?: number        // absolute tick the tombstone vanishes; alpha ramps down from __tombstoneDeath
  __terminalArrowsG?: Graphics
  __terminalCooldownG?: Graphics
  __terminalCooldownTime?: number      // absolute tick the send cooldown ends; pulse runs while > gameTime
  __labMineralG?: Graphics
  __labEnergyG?: Graphics
  __labMineralColor?: number
  __labMineralType?: string
  __labEnergy?: number
  __labEnergyCap?: number
  __labMineral?: number
  __labMineralCap?: number
  __labCooldownG?: Graphics
  __labCooldownTime?: number   // absolute tick the reaction cooldown ends; pulse runs while > gameTime
  __nukerEnergyG?: Graphics
  __nukerGhodiumG?: Graphics
  __nukerEnergy?: number
  __nukerEnergyCap?: number
  __nukerGhodium?: number
  __nukerGhodiumCap?: number
  __powerSpawnPowerG?: Graphics
  __powerSpawnPower?: number
  __powerSpawnPowerCap?: number
  __factoryGearG?: Graphics
  __factoryRingG?: Graphics
  __factoryFillG?: Graphics
  __factoryBands?: StoreBand[]
  __factoryUsed?: number
  __factoryCapacity?: number
  __factoryLevel?: number
  __factoryCooldownEnd?: number   // absolute tick the factory cooldown ends; glow pulses while > gameTime
  __factoryWasOnCd?: boolean      // factory cooldown state last frame, to reset the outline on the falling edge
  __factoryGlowColor?: number
  __barrelContainer?: Container
  __towerAimAngle?: number   // target rotation while an action is active
  __towerAimUntil?: number   // performance.now() timestamp when the aim hold ends
  __towerIdlePhase?: number  // phase offset so idle sweep resumes seamlessly after aiming
  __extractorRing?: Container     // mineral-extractor ring; spins only while on cooldown
  __extractorActive?: boolean     // extractor on cooldown — ring should be spinning
  __extractorWasActive?: boolean  // active state last frame, to detect the resume edge
  __extractorPhase?: number       // rotation offset so the spin resumes without snapping
  __ctrlSegGraphics?: Graphics
  __ctrlSegSprites?: Sprite[]
  __ctrlLevel?: number
  __ctrlProgress?: number
  __ctrlProgressTotal?: number
  __ctrlDowngradeTime?: number
  __ctrlUserId?: string
  __flagColor?: number
  __flagSecondaryColor?: number
  __sourceGraphics?: Graphics
  __sourceEnergy?: number
  __sourceCapacity?: number
  __sourceSize?: number
  __csBuildGlow?: Graphics
  __csFillGraphics?: Graphics
  __csRingGraphics?: Graphics
  __csProgress?: number
  __csProgressTotal?: number
  __csUser?: string
  __csColor?: number
  __csColorDark?: number
  __csColorLight?: number
  __spawnRing?: Graphics
  __spawnRatio?: number | null
  __spawnNeedTime?: number
  __spawnEndTime?: number
  __spawnSig?: string | null
  __spawnEnergy?: number
  __spawnCapacity?: number
  __spawnBadgeSprite?: Sprite
  __fillGraphics?: Graphics
  __powerBankEllipseG?: Graphics
  __powerBankPower?: number
  __powerBankRadius?: number
  __keeperGlow?: Sprite   // keeper-lair pulse glow; scale + alpha driven each frame
  __keeperPhase?: number  // per-lair ping phase offset in [0,1)
  __portalCyanWave?: Graphics  // portal's leading cyan ring; scale + alpha driven each frame
  __portalDarkWave?: Graphics  // portal's trailing dark disc that swallows the cyan ring
  __portalGlow?: Sprite        // portal halo; breathes with the wave cycle
  __portalPhase?: number       // per-portal wave phase offset in [0,1)
  __decorations?: Container[]  // creep/object decoration overlays attached to this visual
  __decoSpawning?: boolean     // spawning state the overlays were built for; creep decorations skip spawning creeps
  __customVisual?: CustomObjectVisual  // mod-defined type rendered from server metadata; owns its own subtree
}
// One generic fill tween. Channel `a` (and optional `b`, for two-channel fills like lab
// energy+mineral or nuker energy+ghodium) eases from→to over EXT_ANIM_DURATION, then `apply`
// repaints the visual. Single-channel fills leave `b` at 0; their `apply` ignores it.
export interface FillAnimation {
  visual: ContainerWithTarget
  fromA: number
  toA: number
  fromB: number
  toB: number
  apply: (visual: ContainerWithTarget, a: number, b: number) => void
  startTime: number
}
/** Everything a per-type visual creator needs to build an object's display tree. */
export interface VisualBuildContext {
  obj: RoomObject
  /** Root container for the visual; creators add children to it. */
  container: Container
  /** Shared body Graphics — some types draw on it; the dispatcher attaches it afterwards. */
  g: Graphics
  /** Fallback palette color for the object type. */
  color: number
  cx: number
  cy: number
  /** ST_OUTLINE for own/neutral structures, OBJ_FOREIGN red for foreign-owned ones. */
  outlineColor: number
  ownedByUser: string | undefined
  showLabel: boolean
  currentUserId?: string
  badgeCache?: BadgeTextureCache
  users?: Record<string, { _id: string; username: string; badge?: Badge }>
}
