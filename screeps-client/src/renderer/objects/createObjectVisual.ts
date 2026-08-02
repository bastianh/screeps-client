// Builds the display tree for one room object by dispatching to the per-type
// creator modules. The shared prelude/postlude (fallback rect, shared-Graphics
// attach, zIndex, position) mirrors the original monolithic switch exactly.
import { Container, Graphics } from 'pixi.js'
import type { RoomObject, Badge } from 'screeps-connectivity'
import type { BadgeTextureCache } from '../BadgeTextureCache.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJ_FOREIGN, ST_OUTLINE } from '../colors.js'
import { computeZIndex, getObjectColor } from './common.js'
import type { VisualBuildContext } from './types.js'
import { createCreepVisual } from './creep.js'
import { createExtensionVisual } from './extension.js'
import { createSpawnVisual } from './spawn.js'
import { createPowerSpawnVisual } from './powerSpawn.js'
import { createSourceVisual } from './source.js'
import { createConstructionSiteVisual } from './constructionSite.js'
import { createMineralVisual, createDepositVisual } from './mineral.js'
import { createControllerVisual } from './controller.js'
import { createTowerVisual } from './tower.js'
import { createStorageVisual } from './storage.js'
import { createTerminalVisual } from './terminal.js'
import { createLinkVisual } from './link.js'
import { createLabVisual } from './lab.js'
import { createContainerVisual } from './container.js'
import { createNukerVisual } from './nuker.js'
import { createFactoryVisual } from './factory.js'
import { createExtractorVisual } from './extractor.js'
import { createFlagVisual } from './flag.js'
import { createRuinVisual } from './ruin.js'
import { createTombstoneVisual } from './tombstone.js'
import { createPowerBankVisual } from './powerBank.js'
import { createKeeperLairVisual } from './keeperLair.js'
import { createPortalVisual } from './portal.js'
import {
  createEnergyVisual,
  createRoadVisual,
  createConstructedWallVisual,
  createRampartVisual,
  createObserverVisual,
  createInvaderCoreVisual,
} from './misc.js'

const CREATORS: Record<string, (ctx: VisualBuildContext) => void> = {
  creep: createCreepVisual,
  extension: createExtensionVisual,
  spawn: createSpawnVisual,
  powerSpawn: createPowerSpawnVisual,
  source: createSourceVisual,
  constructionSite: createConstructionSiteVisual,
  mineral: createMineralVisual,
  deposit: createDepositVisual,
  controller: createControllerVisual,
  energy: createEnergyVisual,
  road: createRoadVisual,
  constructedWall: createConstructedWallVisual,
  rampart: createRampartVisual,
  tower: createTowerVisual,
  storage: createStorageVisual,
  terminal: createTerminalVisual,
  link: createLinkVisual,
  lab: createLabVisual,
  container: createContainerVisual,
  observer: createObserverVisual,
  nuker: createNukerVisual,
  factory: createFactoryVisual,
  extractor: createExtractorVisual,
  invaderCore: createInvaderCoreVisual,
  flag: createFlagVisual,
  ruin: createRuinVisual,
  tombstone: createTombstoneVisual,
  powerBank: createPowerBankVisual,
  keeperLair: createKeeperLairVisual,
  portal: createPortalVisual,
}

// Types that draw on the shared body Graphics `g` and rely on the dispatcher
// attaching it after their creator ran (the rest add their own children).
const ATTACH_SHARED_G = new Set(['spawn', 'powerSpawn', 'energy', 'observer', 'invaderCore', 'extractor'])

export function createObjectVisual(
  obj: RoomObject,
  showLabel = true,
  currentUserId?: string,
  _badge?: Badge,
  badgeCache?: BadgeTextureCache,
  users?: Record<string, { _id: string; username: string; badge?: Badge }>,
): Container {
  const container = new Container()
  const g = new Graphics()
  const color = getObjectColor(obj.type)
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2

  // Foreign-owned structures swap their outline (normally ST_OUTLINE green) for OBJ_FOREIGN red.
  const ownedByUser = typeof obj.user === 'string' ? obj.user : undefined
  const isForeignOwned = ownedByUser !== undefined && currentUserId !== undefined && ownedByUser !== currentUserId
  const outlineColor = isForeignOwned ? OBJ_FOREIGN : ST_OUTLINE

  const ctx: VisualBuildContext = {
    obj, container, g, color, cx, cy, outlineColor, ownedByUser, showLabel, currentUserId, badgeCache, users,
  }

  const creator = CREATORS[obj.type]
  if (creator) {
    creator(ctx)
  } else {
    // Structures (fallback)
    const size = TILE_SIZE - 2
    g.rect(1, 1, size, size)
    g.fill(color)
  }
  if (!creator || ATTACH_SHARED_G.has(obj.type)) {
    container.addChild(g)
  }

  container.zIndex = computeZIndex(obj)

  container.position.set(obj.x * TILE_SIZE, obj.y * TILE_SIZE)
  return container
}
