import { Container, Graphics, Sprite, BlurFilter, Ticker } from 'pixi.js'
import type { RoomObject, RoomObjectMap, RoomObjectDiff, Badge } from 'screeps-connectivity'
import { BadgeTextureCache } from './BadgeTextureCache.js'
import type { LightingLayer } from './LightingLayer.js'
import { TILE_SIZE } from './RoomRenderer.js'
import { DecorationAnimator } from './decorationAnimation.js'
import { destroyTree } from './destroyTree.js'
import { applyObjectDecorations, clearObjectDecorations } from './objectDecorations.js'
import type { CreepDecoration, ObjectDecoration } from './roomDecorations.js'
import { CONTROLLER_DOWNGRADE } from '~/utils/gameConstants.js'
import { OBJ_ROAD, ST_DARK, ST_OUTLINE, ST_ENERGY, ST_RAMPART, ST_RAMPART_STROKE, ST_RAMPART_ENEMY, ST_RAMPART_ENEMY_STROKE, TERRAIN_WALL_BORDER, CS_OWN } from './colors.js'
import {
  calcCenterFillFraction,
  computeZIndex,
  cooldownEnd,
  destroyVisual,
  lerpColor,
  onCooldown,
  resourceColor,
} from './objects/common.js'
import { CS_FILL_R, CS_GLOW_R, CS_PULSE_MS, drawCSProgress, drawCSRing } from './objects/constructionSite.js'
import { calcContainerFillHeight, updateContainerFill } from './objects/container.js'
import {
  CTRL_SEG_IN,
  CTRL_SEG_OUT,
  drawControllerSegments,
  updateControllerSegSprites,
} from './objects/controller.js'
import { createObjectVisual } from './objects/createObjectVisual.js'
import { customObjectMetadata, customRendererRevision } from './custom/registry.js'
import {
  DISABLED_PEAK_ALPHA,
  computeDisabledIds,
  disabledPulseAlpha,
  drawDisabledTiles,
} from './objects/disabled.js'
import {
  CREEP_INNER_R,
  LABEL_CREEP_TOP,
  LABEL_FONT_SCALE,
  LABEL_GAP_PX,
  SAY_GAP_PX,
  buildSayBubble,
  calcCreepFillRadius,
  getCreepStore,
  isForeignCreep,
  npcCreepName,
  setCreepFacing,
  updateCreepFill,
} from './objects/creep.js'
import { calcExtensionFillRadius, getExtensionEnergy, updateExtensionFill } from './objects/extension.js'
import { EXTRACTOR_RING_SPEED } from './objects/extractor.js'
import {
  FACT_GLOW,
  calcFactoryFillHeight,
  drawFactoryGear,
  drawFactoryRing,
  updateFactoryFill,
} from './objects/factory.js'
import { KL_PULSE_ALPHA, KL_PULSE_MAX_R, KL_PULSE_MIN_R, KL_PULSE_MS } from './objects/keeperLair.js'
import { getLabContents, updateLabFill } from './objects/lab.js'
import { calcLinkFillFraction, updateLinkFill } from './objects/link.js'
import { getNukerContents, updateNukerFill } from './objects/nuker.js'
import { animatePortal } from './objects/portal.js'
import { calcPowerBankRadius, drawPowerBankEllipse, getPowerBankPower } from './objects/powerBank.js'
import { getPowerSpawnPower, updatePowerSpawnPower } from './objects/powerSpawn.js'
import {
  SRC_MAX_SIZE,
  calcSourceSize,
  drawSourceVisual,
  getSourceEnergy,
  updateSourceVisual,
} from './objects/source.js'
import { calcSpawnFillRadius, drawSpawnRing, spawnRatio, spawnSig, spawnTiming } from './objects/spawn.js'
import { calcStorageFillHeight, updateStorageFill } from './objects/storage.js'
import { bandsEqual, getStoreBands } from './objects/store.js'
import { TERMINAL_ARROW_CD_ALPHA, updateTerminalFill } from './objects/terminal.js'
import {
  TOWER_AIM_LERP,
  TOWER_BARREL_FORWARD,
  TOWER_IDLE_SPEED,
  approachAngle,
  calcTowerFillHeight,
  updateTowerFill,
} from './objects/tower.js'
import { type ContainerWithTarget, type FillAnimation } from './objects/types.js'

const sharedBadgeCache = new BadgeTextureCache()

export interface ObjectEntry {
  id: string
  obj: RoomObject
  visual: ContainerWithTarget
}

export class ObjectLayer {
  readonly container: Container
  /**
   * Ramparts, rendered separately from `container` so a caller can place them above the
   * lighting layer's dark overlay (`Z.rampartGlow`) — the ambient multiply would otherwise
   * dim the glow, unlike vanilla's rampart which lives past the light map in its own
   * "effects" layer.
   */
  readonly rampartLayer: Container
  private objects = new Map<string, ContainerWithTarget>()
  private rawObjects = new Map<string, RoomObject>()
  private roadGraphics: Graphics
  private rampartGraphics: Graphics
  private rampartGlowGraphics: Graphics
  private wallGraphics: Graphics
  private wallMarkGraphics: Graphics
  private disabledGraphics: Graphics
  private disabledSig = ''
  private ticker: Ticker | null = null
  private tickerCallback: (() => void) | null = null
  // One map for every fill tween (extension/creep/tower/storage/container/terminal/factory/
  // lab/nuker/link/source). An object has a single type, so its id maps to at most one entry.
  private fillAnimations = new Map<string, FillAnimation>()
  private buildGlowAnimations = new Map<string, { startTime: number; duration: number }>()
  private ctrlFlashAnimations = new Map<string, { segIndex: number; startTime: number; duration: number }>()
  private currentGameTime = 0
  private sayBubbles = new Set<string>()
  private moveDuration = 600
  private tickMs = 2000        // full wall-clock duration of one game tick (from RoomViewer)
  private lastTickAt = 0       // performance.now() when the current game tick began
  private readonly EXT_ANIM_DURATION = 300
  private instantMode = false
  private lastWorldScale = 1
  private customRendererRev = customRendererRevision()
  private showLabels: boolean
  private currentUserId?: string
  private badge?: Badge
  private readonly badgeCache = sharedBadgeCache
  private users?: Record<string, { _id: string; username: string; badge?: Badge }>
  private roadColor: number = OBJ_ROAD
  private wallColor: number = ST_DARK
  private lighting: LightingLayer | null = null
  private creepDecorations: readonly CreepDecoration[] = []
  private objectDecorations: readonly ObjectDecoration[] = []
  private decorationAnimator: DecorationAnimator | null = null

  constructor(ticker?: Ticker, showLabels = true, currentUserId?: string, badge?: Badge, users?: Record<string, { _id: string; username: string; badge?: Badge }>) {
    this.showLabels = showLabels
    this.currentUserId = currentUserId
    this.badge = badge
    this.users = users
    this.container = new Container()
    this.container.sortableChildren = true
    this.wallGraphics = new Graphics()
    this.wallGraphics.zIndex = -3
    this.container.addChild(this.wallGraphics)
    this.wallMarkGraphics = new Graphics()
    this.wallMarkGraphics.zIndex = -2
    this.container.addChild(this.wallMarkGraphics)
    this.rampartLayer = new Container()
    this.rampartLayer.sortableChildren = true
    this.rampartGraphics = new Graphics()
    // Additive, like the reference's rampart sprite (`BLEND_MODES.ADD` in its topmost
    // "effects" layer): it *adds* a green cast rather than covering what's underneath, so
    // a creep standing on a rampart still reads clearly instead of being tinted away — the
    // fill only ever brightens, never darkens or obscures. Relative order within
    // `rampartLayer`; the layer itself sits above every other room layer (see its doc).
    this.rampartGraphics.zIndex = 150
    this.rampartGraphics.blendMode = 'add'
    this.rampartLayer.addChild(this.rampartGraphics)
    // Soft rim glow, blurred via the same BlurFilter pattern the swamp glow uses
    // (TerrainLayer.createSwampGlow). Sits just below the fill layer so its halo
    // reads past the blob edge and tints up through the translucent fill, while the
    // crisp rim draws on top. Additive for the same reason as the fill above.
    this.rampartGlowGraphics = new Graphics()
    this.rampartGlowGraphics.zIndex = 149
    this.rampartGlowGraphics.blendMode = 'add'
    this.rampartGlowGraphics.filters = [new BlurFilter({ strength: 3, quality: 3 })]
    this.rampartLayer.addChild(this.rampartGlowGraphics)
    this.roadGraphics = new Graphics()
    this.container.addChild(this.roadGraphics)
    // Disabled-structure wash: above structures and creeps, below flags — the same
    // stacking vanilla gets from drawing it in its "effects" layer. Additive, so it
    // reads as a red glow over the structure rather than a flat cover. Sits below
    // `rampartLayer` now that ramparts render past the dark overlay (see its doc) — a
    // ramparted disabled structure shows the glow tinted through the translucent rampart
    // fill rather than on top of it, a minor trade-off for ramparts not reading muddy.
    this.disabledGraphics = new Graphics()
    this.disabledGraphics.zIndex = 160
    this.disabledGraphics.blendMode = 'add'
    this.disabledGraphics.alpha = 0
    this.container.addChild(this.disabledGraphics)
    if (ticker) {
      this.ticker = ticker
      this.tickerCallback = () => this.tick()
      ticker.add(this.tickerCallback)
      this.decorationAnimator = new DecorationAnimator(ticker)
    }
  }

  /**
   * Set the creep and object decoration overlays. Re-applies them to every visual that
   * already exists, so this can be called whenever the room's decorations change.
   */
  setDecorations(creeps: readonly CreepDecoration[], objects: readonly ObjectDecoration[]): void {
    this.creepDecorations = creeps
    this.objectDecorations = objects
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (obj) this.decorate(visual, obj)
    }
  }

  /** Build an object's visual, register it and attach it to the scene. */
  private createVisual(id: string, obj: RoomObject): ContainerWithTarget {
    const visual: ContainerWithTarget = createObjectVisual(obj, this.showLabels, this.currentUserId, this.badge, this.badgeCache, this.users)
    visual.__tileX = obj.x
    visual.__tileY = obj.y
    this.applyLabelScale(visual)
    this.decorate(visual, obj)
    this.objects.set(id, visual)
    this.container.addChild(visual)
    return visual
  }

  private decorate(visual: ContainerWithTarget, obj: RoomObject): void {
    if (!this.decorationAnimator) return
    if (this.creepDecorations.length === 0 && this.objectDecorations.length === 0) {
      clearObjectDecorations(visual)
      return
    }
    applyObjectDecorations(visual, obj, this.creepDecorations, this.objectDecorations, this.decorationAnimator)
  }

  setRoadColor(color: number): void {
    this.roadColor = color
    this.redrawRoads()
  }

  setWallColor(color: number): void {
    this.wallColor = color
    this.redrawWalls()
  }

  // The dark-overlay lightmap. ObjectLayer drives per-frame light positions so a
  // creep's light pool follows its interpolated motion instead of snapping at
  // tick end (the set of lights is reconciled per tick from RoomRenderer).
  setLightingLayer(lighting: LightingLayer | null): void {
    this.lighting = lighting
  }

  private tick(): void {
    const tNow = performance.now()

    // Creep movement interpolation — linear over ~90% of the current tick duration
    // (driven from RoomViewer via setMoveDuration()). The light pool is nudged to
    // match each frame so it tracks the sprite instead of snapping at tick end.
    const lighting = this.lighting
    for (const [id, visual] of this.objects) {
      if (visual.__targetX === undefined || visual.__targetY === undefined) continue
      const dur = visual.__moveDur ?? 0
      const startT = visual.__moveStartT ?? tNow
      const elapsed = tNow - startT
      if (dur <= 0 || elapsed >= dur) {
        visual.position.set(visual.__targetX, visual.__targetY)
        visual.__targetX = undefined
        visual.__targetY = undefined
        visual.__moveStartX = undefined
        visual.__moveStartY = undefined
        visual.__moveStartT = undefined
        visual.__moveDur = undefined
        lighting?.setLightPosition(id, visual.x + TILE_SIZE / 2, visual.y + TILE_SIZE / 2)
        continue
      }
      const t = elapsed / dur
      const sx = visual.__moveStartX ?? visual.x
      const sy = visual.__moveStartY ?? visual.y
      visual.x = sx + (visual.__targetX - sx) * t
      visual.y = sy + (visual.__targetY - sy) * t
      lighting?.setLightPosition(id, visual.x + TILE_SIZE / 2, visual.y + TILE_SIZE / 2)
    }

    // Say bubbles intentionally have no timer-based expiry — their lifecycle is
    // driven entirely by the room:update tick signal (triggerSay + pruneSayBubblesExcept).

    // Label scale: invert world zoom so labels stay at constant screen size.
    // Relative to the (now larger) creep this makes them appear smaller on zoom-in.
    const worldScale = this.container.parent?.scale.x ?? 1
    if (worldScale !== this.lastWorldScale) {
      this.lastWorldScale = worldScale
      for (const visual of this.objects.values()) {
        this.applyLabelScale(visual)
      }
    }

    // Time-based animations (independent of game tick)
    const now = performance.now()
    const t_sec = now / 1000

    // Tower barrel rotation + construction-site ring pulsation
    const pulse = 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / CS_PULSE_MS)
    // Tick-aligned pulse for the lab cooldown glow: one full breath (0 → 1 → 0) per game tick,
    // so the rhythm stretches/compresses with the tick rate the way vanilla does, rather than
    // running at a fixed wall-clock period.
    const tickFrac = Math.min(1, (now - this.lastTickAt) / this.tickMs)
    // one breath per tick, shared by lab + terminal glows. In instant mode the tick-aligned
    // pulse is frozen to a steady glow so the on-cooldown state still reads without animating.
    const cooldownPulse = this.instantMode ? 1 : Math.sin(tickFrac * Math.PI)
    for (const visual of this.objects.values()) {
      if (visual.__barrelContainer) {
        const turret = visual.__barrelContainer
        if (visual.__towerAimUntil !== undefined && now < visual.__towerAimUntil && visual.__towerAimAngle !== undefined) {
          // Firing / repairing: turn quickly toward the target and hold there.
          turret.rotation = approachAngle(turret.rotation, visual.__towerAimAngle, TOWER_AIM_LERP)
        } else {
          if (visual.__towerAimUntil !== undefined) {
            // Action finished — rebase the idle phase so the sweep resumes from
            // the current angle instead of snapping back to the global sweep.
            visual.__towerIdlePhase = turret.rotation - t_sec * TOWER_IDLE_SPEED
            visual.__towerAimUntil = undefined
            visual.__towerAimAngle = undefined
          }
          turret.rotation = t_sec * TOWER_IDLE_SPEED + (visual.__towerIdlePhase ?? 0)
        }
      }
      if (visual.__extractorRing) {
        // Spin only while on cooldown, freeze otherwise. On the rising edge rebase the
        // phase so the spin resumes from its current angle instead of snapping (the
        // tower idle-sweep idiom).
        const extActive = visual.__extractorActive === true
        if (extActive && !visual.__extractorWasActive) {
          visual.__extractorPhase = visual.__extractorRing.rotation - t_sec * EXTRACTOR_RING_SPEED
        }
        if (extActive) {
          visual.__extractorRing.rotation = t_sec * EXTRACTOR_RING_SPEED + (visual.__extractorPhase ?? 0)
        }
        visual.__extractorWasActive = extActive
      }
      if (visual.__csRingGraphics && visual.__csColorDark !== undefined && visual.__csColorLight !== undefined) {
        drawCSRing(visual.__csRingGraphics, lerpColor(visual.__csColorDark, visual.__csColorLight, pulse))
      }
      // Factory outline pulses brighter while on cooldown. Like the lab, the factory's
      // cooldownTime is absolute and sent once, so evaluate it live each frame and reset the
      // outline to its static colour on the falling edge (no update fires when it expires).
      if (visual.__factoryGearG) {
        const facOnCd = (visual.__factoryCooldownEnd ?? 0) > this.currentGameTime
        if (facOnCd) {
          drawFactoryGear(visual.__factoryGearG, lerpColor(visual.__factoryGlowColor ?? ST_OUTLINE, FACT_GLOW, 0.5 * pulse))
        } else if (visual.__factoryWasOnCd) {
          drawFactoryGear(visual.__factoryGearG, visual.__factoryGlowColor ?? ST_OUTLINE)
        }
        visual.__factoryWasOnCd = facOnCd
      }
      // Lab cooldown pulse: the bowl halo completes one breath per game tick (alpha 0 → peak
      // → 0, via cooldownPulse) while the lab's absolute cooldownTime is still ahead of the live
      // game clock — tick-aligned so the rhythm tracks the tick rate like vanilla.
      if (visual.__labCooldownG) {
        const onCd = (visual.__labCooldownTime ?? 0) > this.currentGameTime
        visual.__labCooldownG.alpha = onCd ? cooldownPulse : 0
      }
      // Tombstone decay: fades from full at deathTime to nothing at decayTime, matching vanilla.
      // Only set when the server sent a sane pair (see tombstoneDecay), so elsewhere it stays opaque.
      if (visual.__tombstoneDecayTime !== undefined) {
        const death = visual.__tombstoneDeath ?? 0
        const span = visual.__tombstoneDecayTime - death
        visual.alpha = Math.min(1, Math.max(0, 1 - (this.currentGameTime - death) / span))
      }
      // Terminal cooldown: the arrow ring breathes once per game tick (same tick-aligned pulse
      // as the lab) and the arrows dim under it, while the absolute cooldownTime is still ahead
      // of the live game clock.
      if (visual.__terminalCooldownG) {
        const onCd = (visual.__terminalCooldownTime ?? 0) > this.currentGameTime
        visual.__terminalCooldownG.alpha = onCd ? cooldownPulse : 0
        if (visual.__terminalArrowsG) visual.__terminalArrowsG.alpha = onCd ? TERMINAL_ARROW_CD_ALPHA : 1
      }
      // Keeper-lair pulse: expand-and-fade glow on a free-running wall-clock cycle, offset per lair
      // so neighbours don't ping in lockstep. Pure scale + alpha on the shared glow sprite; the sin
      // envelope is 0 at both ends, so the radius reset at the wrap happens while fully invisible.
      if (visual.__keeperGlow) {
        const p = ((now / KL_PULSE_MS) + (visual.__keeperPhase ?? 0)) % 1
        const rp = 1 - (1 - p) * (1 - p)   // ease-out: shoots outward, then eases as it nears the rim
        const radius = KL_PULSE_MIN_R + rp * (KL_PULSE_MAX_R - KL_PULSE_MIN_R)
        visual.__keeperGlow.width = visual.__keeperGlow.height = radius * 2
        visual.__keeperGlow.alpha = KL_PULSE_ALPHA * Math.sin(Math.PI * p)   // smooth in/out, no pop at wrap
      }
      // Portal: cyan ring wells up and is swallowed by the trailing dark disc, on the same
      // free-running wall clock as the keeper pulse (see animatePortal for the wave shapes).
      if (visual.__portalCyanWave) animatePortal(visual, now)
      // Source pulse: repaint every frame so the golden core (or the dark ring, when
      // exhausted) breathes. The size tween below writes __sourceSize and repaints again
      // while it runs, so drawing before it never shows a stale size.
      if (visual.__sourceGraphics) drawSourceVisual(visual.__sourceGraphics, visual.__sourceSize ?? SRC_MAX_SIZE, now)
      // Power bank: fill colour and scale pulse run on the wall clock every frame.
      if (visual.__powerBankEllipseG) drawPowerBankEllipse(visual.__powerBankEllipseG, visual.__powerBankRadius ?? 0, now)
      if (visual.__ctrlLevel && visual.__ctrlSegSprites) this.applyControllerDowngradeTint(visual, now)
    }

    // Fill tweens (extension/creep/tower/storage/container/terminal/factory/lab/nuker/link/source)
    for (const [id, anim] of this.fillAnimations) {
      const t = Math.min(1, (now - anim.startTime) / this.EXT_ANIM_DURATION)
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      anim.apply(anim.visual, anim.fromA + (anim.toA - anim.fromA) * ease, anim.fromB + (anim.toB - anim.fromB) * ease)
      if (t >= 1) this.fillAnimations.delete(id)
    }

    // Construction-site build glow: fade in during beam build phase, hold, fade out
    for (const [id, anim] of this.buildGlowAnimations) {
      const visual = this.objects.get(id)
      const glow = visual?.__csBuildGlow
      if (!visual || !glow) {
        this.buildGlowAnimations.delete(id)
        continue
      }
      const t = (now - anim.startTime) / anim.duration
      let alpha: number
      if (t <= 0)      alpha = 0
      else if (t < 0.5) alpha = t / 0.5
      else if (t < 0.7) alpha = 1
      else if (t < 1)   alpha = 1 - (t - 0.7) / 0.3
      else              alpha = 0

      glow.clear()
      if (alpha > 0) {
        glow.circle(TILE_SIZE / 2, TILE_SIZE / 2, CS_GLOW_R)
        glow.fill({ color: ST_ENERGY, alpha: alpha * 0.75 })
      }
      if (t >= 1) this.buildGlowAnimations.delete(id)
    }

    // Controller segment flash: the next (not-yet-earned) segment briefly lights up
    // when progress increases, then fades back to its dim base alpha (0.15).
    for (const [id, anim] of this.ctrlFlashAnimations) {
      const visual = this.objects.get(id)
      const segs = visual?.__ctrlSegSprites
      if (!visual || !segs) {
        this.ctrlFlashAnimations.delete(id)
        continue
      }
      const t = Math.min(1, (now - anim.startTime) / anim.duration)
      const ease = 1 - (1 - t) * (1 - t)  // ease-out: peaks immediately, fades back
      const seg = segs[anim.segIndex]
      if (seg && !seg.destroyed) {
        seg.alpha = 1.0 - (1.0 - 0.15) * ease
      }
      if (t >= 1) {
        if (seg && !seg.destroyed) seg.alpha = 0.15
        this.ctrlFlashAnimations.delete(id)
      }
    }

    // Disabled-structure wash: one shared pulse for every off tile. Frozen at peak in
    // instant/history mode so the state still reads without animating.
    if (this.disabledSig !== '') {
      this.disabledGraphics.alpha = this.instantMode ? DISABLED_PEAK_ALPHA : disabledPulseAlpha(now)
    }

    // Composite the lightmap once per frame (no-op unless a light moved this
    // frame). Runs after interpolation so the texture is up to date before the
    // main frame is presented.
    this.lighting?.render()
  }

  // Controller downgrade warning: earned segments (0..level-1) tint pink→red, pulsing
  // faster as the downgrade deadline approaches; plain white with no deadline or while
  // the remaining time is still comfortable.
  private applyControllerDowngradeTint(visual: ContainerWithTarget, now: number): void {
    const level = visual.__ctrlLevel
    const segs = visual.__ctrlSegSprites
    if (!level || !segs) return

    const dt = visual.__ctrlDowngradeTime
    if (!dt) {
      for (let i = 0; i < level; i++) {
        const seg = segs[i]
        if (seg && !seg.destroyed) seg.tint = 0xffffff
      }
      return
    }

    const maxTicks = CONTROLLER_DOWNGRADE[level] ?? 20000
    const remaining = Math.max(0, dt - this.currentGameTime)
    const urgency = 1 - remaining / maxTicks

    if (urgency <= 0.2) {
      for (let i = 0; i < level; i++) {
        const seg = segs[i]
        if (seg && !seg.destroyed) seg.tint = 0xffffff
      }
      return
    }

    const danger = (urgency - 0.2) / 0.8
    const pulseHz = 0.3 + danger * 1.5
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * pulseHz * now / 1000)
    const peakColor = lerpColor(0xffdddd, 0xff2222, danger)
    const tintColor = lerpColor(0xffffff, peakColor, danger * pulse)

    for (let i = 0; i < level; i++) {
      const seg = segs[i]
      if (seg && !seg.destroyed) seg.tint = tintColor
    }
  }

  // Centralised fill-tween launcher. Instant-mode snaps straight to the target; an
  // unchanged target is a no-op; otherwise the tween runs and `apply` repaints each frame.
  // `apply` is the per-structure repaint (single-channel repaints ignore the `b` value).
  private startFill(
    id: string,
    visual: ContainerWithTarget,
    apply: (visual: ContainerWithTarget, a: number, b: number) => void,
    fromA: number, toA: number, fromB = 0, toB = 0,
  ): void {
    if (this.instantMode) { apply(visual, toA, toB); return }
    if (fromA === toA && fromB === toB) return
    this.fillAnimations.set(id, { visual, fromA, toA, fromB, toB, apply, startTime: performance.now() })
  }

  private startExtAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateExtensionFill,
      calcExtensionFillRadius(fromEnergy, fromCapacity), calcExtensionFillRadius(toEnergy, toCapacity))
  }

  private startLinkAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateLinkFill,
      calcLinkFillFraction(fromEnergy, fromCapacity), calcLinkFillFraction(toEnergy, toCapacity))
  }

  private startCreepFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateCreepFill,
      calcCreepFillRadius(fromUsed, fromCapacity), calcCreepFillRadius(toUsed, toCapacity))
  }

  private startTowerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateTowerFill,
      calcTowerFillHeight(fromEnergy, fromCapacity), calcTowerFillHeight(toEnergy, toCapacity))
  }

  private startStorageFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateStorageFill,
      calcStorageFillHeight(fromUsed, fromCapacity), calcStorageFillHeight(toUsed, toCapacity))
  }

  private startContainerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateContainerFill,
      calcContainerFillHeight(fromUsed, fromCapacity), calcContainerFillHeight(toUsed, toCapacity))
  }

  private startTerminalFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateTerminalFill,
      calcCenterFillFraction(fromUsed, fromCapacity), calcCenterFillFraction(toUsed, toCapacity))
  }

  private startFactoryFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromUsed: number, fromCapacity: number, toUsed: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateFactoryFill,
      calcFactoryFillHeight(fromUsed, fromCapacity), calcFactoryFillHeight(toUsed, toCapacity))
  }

  private startLabFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromE: number, fromECap: number, fromM: number, fromMCap: number,
    toE: number, toECap: number, toM: number, toMCap: number,
  ): void {
    this.startFill(id, visual, updateLabFill,
      calcCenterFillFraction(fromE, fromECap), calcCenterFillFraction(toE, toECap),
      calcCenterFillFraction(fromM, fromMCap), calcCenterFillFraction(toM, toMCap))
  }

  private startNukerFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromE: number, fromECap: number, fromG: number, fromGCap: number,
    toE: number, toECap: number, toG: number, toGCap: number,
  ): void {
    this.startFill(id, visual, updateNukerFill,
      calcCenterFillFraction(fromE, fromECap), calcCenterFillFraction(toE, toECap),
      calcCenterFillFraction(fromG, fromGCap), calcCenterFillFraction(toG, toGCap))
  }

  private startSourceAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateSourceVisual,
      calcSourceSize(fromEnergy, fromCapacity), calcSourceSize(toEnergy, toCapacity))
  }

  private startPowerSpawnPowerAnimation(
    id: string, visual: ContainerWithTarget,
    fromPower: number, fromCap: number, toPower: number, toCap: number,
  ): void {
    this.startFill(id, visual, updatePowerSpawnPower,
      calcCenterFillFraction(fromPower, fromCap), calcCenterFillFraction(toPower, toCap))
  }

  private startSpawnFillAnimation(
    id: string, visual: ContainerWithTarget,
    fromEnergy: number, fromCapacity: number, toEnergy: number, toCapacity: number,
  ): void {
    this.startFill(id, visual, updateExtensionFill,
      calcSpawnFillRadius(fromEnergy, fromCapacity), calcSpawnFillRadius(toEnergy, toCapacity))
  }

  /**
   * Apply an updated object's state to its existing visual — position/movement, per-type
   * fills and cooldowns, and the recreate-on-identity-change cases (flag colours,
   * controller owner). Shared by the diff path and the full-map reconcile path
   * (history playback, resubscribe) so every type stays live in both.
   */
  private updateExistingVisual(id: string, obj: RoomObject, existing: ContainerWithTarget, fullReconcile: boolean): void {
    const tx = obj.x * TILE_SIZE
    const ty = obj.y * TILE_SIZE
    if (obj.type === 'creep') {
      const dx = obj.x - (existing.__tileX ?? obj.x)
      const dy = obj.y - (existing.__tileY ?? obj.y)
      if (dx !== 0 || dy !== 0) {
        existing.__angle = Math.atan2(dy, dx)
        setCreepFacing(existing, existing.__angle)
      }
      existing.__tileX = obj.x
      existing.__tileY = obj.y
      if (this.instantMode) {
        existing.position.set(tx, ty)
        existing.__targetX = undefined
        existing.__targetY = undefined
        existing.__moveStartX = undefined
        existing.__moveStartY = undefined
        existing.__moveStartT = undefined
        existing.__moveDur = undefined
      } else if (existing.x !== tx || existing.y !== ty) {
        existing.__targetX = tx
        existing.__targetY = ty
        existing.__moveStartX = existing.x
        existing.__moveStartY = existing.y
        existing.__moveStartT = performance.now()
        existing.__moveDur = this.moveDuration
      }
      const { used, capacity } = getCreepStore(obj)
      if (existing.__creepUsed !== used || existing.__creepCapacity !== capacity) {
        this.startCreepFillAnimation(id, existing, existing.__creepUsed ?? 0, existing.__creepCapacity ?? capacity, used, capacity)
        existing.__creepUsed = used
        existing.__creepCapacity = capacity
      }
      // Re-tier on the spawning → born transition (and vice-versa).
      const cz = computeZIndex(obj)
      if (existing.zIndex !== cz) existing.zIndex = cz
      // Creep decorations skip spawning creeps, so that transition changes what applies.
      if (existing.__decoSpawning !== (obj.spawning === true)) this.decorate(existing, obj)
    } else if (obj.type === 'flag') {
      const newColorIdx = typeof obj.color === 'number' ? obj.color : 0
      const newSecColorIdx = typeof obj.secondaryColor === 'number' ? obj.secondaryColor : 0
      const colorChanged =
        existing.__flagColor !== newColorIdx ||
        existing.__flagSecondaryColor !== newSecColorIdx
      if (colorChanged) {
        this.container.removeChild(existing)
        destroyVisual(existing)
        this.objects.delete(id)
        this.createVisual(id, obj)
      } else {
        existing.position.set(tx, ty)
      }
    } else {
      existing.position.set(tx, ty)
    }

    // Mod-defined types re-run their metadata; which processors that actually
    // rebuilds is decided inside, from each one's `props`.
    existing.__customVisual?.applyState(obj)

    if (obj.type === 'extension') {
      const { energy, capacity } = getExtensionEnergy(obj)
      const ext = existing as ContainerWithTarget & { __extEnergy?: number; __extCapacity?: number }
      if (ext.__extEnergy !== energy || ext.__extCapacity !== capacity) {
        this.startExtAnimation(
          id,
          existing,
          ext.__extEnergy ?? 0,
          ext.__extCapacity ?? capacity,
          energy,
          capacity,
        )
        ext.__extEnergy = energy
        ext.__extCapacity = capacity
      }
    }
    if (obj.type === 'link') {
      const { energy, capacity } = getExtensionEnergy(obj)
      if (existing.__linkEnergy !== energy || existing.__linkCapacity !== capacity) {
        this.startLinkAnimation(id, existing, existing.__linkEnergy ?? 0, existing.__linkCapacity ?? capacity, energy, capacity)
        existing.__linkEnergy = energy
        existing.__linkCapacity = capacity
      }
    }
    if (obj.type === 'tower') {
      const { energy, capacity } = getExtensionEnergy(obj)
      if (existing.__towerEnergy !== energy || existing.__towerCapacity !== capacity) {
        this.startTowerFillAnimation(id, existing, existing.__towerEnergy ?? 0, existing.__towerCapacity ?? capacity, energy, capacity)
        existing.__towerEnergy = energy
        existing.__towerCapacity = capacity
      }
    }
    if (obj.type === 'storage') {
      const { bands, used, capacity } = getStoreBands(obj)
      if (existing.__storageUsed !== used || existing.__storageCapacity !== capacity) {
        const fromUsed = existing.__storageUsed ?? 0
        const fromCap = existing.__storageCapacity ?? capacity
        existing.__storageBands = bands
        existing.__storageUsed = used
        existing.__storageCapacity = capacity
        this.startStorageFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
      } else if (!bandsEqual(existing.__storageBands, bands)) {
        existing.__storageBands = bands
        updateStorageFill(existing, calcStorageFillHeight(used, capacity))
      }
    }
    if (obj.type === 'container') {
      const { bands, used, capacity } = getStoreBands(obj)
      if (existing.__containerUsed !== used || existing.__containerCapacity !== capacity) {
        const fromUsed = existing.__containerUsed ?? 0
        const fromCap = existing.__containerCapacity ?? capacity
        existing.__containerBands = bands
        existing.__containerUsed = used
        existing.__containerCapacity = capacity
        this.startContainerFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
      } else if (!bandsEqual(existing.__containerBands, bands)) {
        existing.__containerBands = bands
        updateContainerFill(existing, calcContainerFillHeight(used, capacity))
      }
    }
    if (obj.type === 'terminal') {
      const { used, capacity, dominant: dom } = getStoreBands(obj)
      const dominant = dom ?? undefined
      if (existing.__terminalDominant !== dominant) {
        existing.__terminalDominant = dominant
        existing.__terminalFillColor = dominant ? resourceColor(dominant) : ST_ENERGY
        updateTerminalFill(existing, calcCenterFillFraction(used, capacity))
      }
      if (existing.__terminalUsed !== used || existing.__terminalCapacity !== capacity) {
        const fromUsed = existing.__terminalUsed ?? 0
        const fromCap = existing.__terminalCapacity ?? capacity
        existing.__terminalUsed = used
        existing.__terminalCapacity = capacity
        this.startTerminalFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
      }
      existing.__terminalCooldownTime = cooldownEnd(obj)
    }
    if (obj.type === 'lab') {
      const { energy, energyCap, mineralType, mineral, mineralCap } = getLabContents(obj)
      const newType = mineralType ?? undefined
      if (existing.__labMineralType !== newType) {
        existing.__labMineralType = newType
        existing.__labMineralColor = mineralType ? resourceColor(mineralType) : undefined
        updateLabFill(existing, calcCenterFillFraction(energy, energyCap), calcCenterFillFraction(mineral, mineralCap))
      }
      if (existing.__labEnergy !== energy || existing.__labEnergyCap !== energyCap ||
          existing.__labMineral !== mineral || existing.__labMineralCap !== mineralCap) {
        const fromE = existing.__labEnergy ?? 0
        const fromECap = existing.__labEnergyCap ?? energyCap
        const fromM = existing.__labMineral ?? 0
        const fromMCap = existing.__labMineralCap ?? mineralCap
        existing.__labEnergy = energy
        existing.__labEnergyCap = energyCap
        existing.__labMineral = mineral
        existing.__labMineralCap = mineralCap
        this.startLabFillAnimation(id, existing, fromE, fromECap, fromM, fromMCap, energy, energyCap, mineral, mineralCap)
      }
      existing.__labCooldownTime = cooldownEnd(obj)
    }
    if (obj.type === 'nuker') {
      const { energy, energyCap, ghodium, ghodiumCap } = getNukerContents(obj)
      if (existing.__nukerEnergy !== energy || existing.__nukerEnergyCap !== energyCap ||
          existing.__nukerGhodium !== ghodium || existing.__nukerGhodiumCap !== ghodiumCap) {
        const fromE = existing.__nukerEnergy ?? 0
        const fromECap = existing.__nukerEnergyCap ?? energyCap
        const fromG = existing.__nukerGhodium ?? 0
        const fromGCap = existing.__nukerGhodiumCap ?? ghodiumCap
        existing.__nukerEnergy = energy
        existing.__nukerEnergyCap = energyCap
        existing.__nukerGhodium = ghodium
        existing.__nukerGhodiumCap = ghodiumCap
        this.startNukerFillAnimation(id, existing, fromE, fromECap, fromG, fromGCap, energy, energyCap, ghodium, ghodiumCap)
      }
    }
    if (obj.type === 'powerSpawn') {
      const { power, powerCap } = getPowerSpawnPower(obj)
      if (existing.__powerSpawnPower !== power || existing.__powerSpawnPowerCap !== powerCap) {
        const fromPower = existing.__powerSpawnPower ?? 0
        const fromCap = existing.__powerSpawnPowerCap ?? powerCap
        existing.__powerSpawnPower = power
        existing.__powerSpawnPowerCap = powerCap
        this.startPowerSpawnPowerAnimation(id, existing, fromPower, fromCap, power, powerCap)
      }
    }
    if (obj.type === 'extractor') {
      existing.__extractorActive = onCooldown(obj)
    }
    if (obj.type === 'factory') {
      const { bands, used, capacity } = getStoreBands(obj)
      const level = typeof obj.level === 'number' ? obj.level : 0
      if (existing.__factoryLevel !== level && existing.__factoryRingG) {
        existing.__factoryLevel = level
        drawFactoryRing(existing.__factoryRingG, level)
      }
      // Absolute cooldownTime; the ticker evaluates it live and resets on expiry.
      existing.__factoryCooldownEnd = cooldownEnd(obj)
      if (existing.__factoryUsed !== used || existing.__factoryCapacity !== capacity) {
        const fromUsed = existing.__factoryUsed ?? 0
        const fromCap = existing.__factoryCapacity ?? capacity
        existing.__factoryBands = bands
        existing.__factoryUsed = used
        existing.__factoryCapacity = capacity
        this.startFactoryFillAnimation(id, existing, fromUsed, fromCap, used, capacity)
      } else if (!bandsEqual(existing.__factoryBands, bands)) {
        existing.__factoryBands = bands
        updateFactoryFill(existing, calcFactoryFillHeight(used, capacity))
      }
    }
    if (obj.type === 'controller') {
      const level         = typeof obj.level         === 'number' ? obj.level         : 0
      const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
      const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 0
      const newResObj     = obj.reservation as { user?: string } | undefined
      const newUserId     = typeof obj.user === 'string' ? obj.user
        : typeof newResObj?.user === 'string' ? newResObj.user
        : undefined
      if (existing.__ctrlUserId !== newUserId) {
        this.container.removeChild(existing)
        destroyVisual(existing)
        this.objects.delete(id)
        this.createVisual(id, obj)
        return
      }
      if (existing.__ctrlLevel !== level || existing.__ctrlProgress !== progress || existing.__ctrlProgressTotal !== progressTotal) {
        if (existing.__ctrlSegSprites) {
          if (!this.instantMode) {
            if (fullReconcile) {
              // A full snapshot re-sends progress on nearly every tick (history playback,
              // resubscribe), so only a level-up flashes there; a diff flashes the next
              // segment whenever progress grows.
              if (level > (existing.__ctrlLevel ?? 0) && level > 0) {
                this.ctrlFlashAnimations.set(id, { segIndex: level - 1, startTime: performance.now(), duration: 500 })
              }
            } else if (level < 8 && progress > (existing.__ctrlProgress ?? 0)) {
              this.ctrlFlashAnimations.set(id, { segIndex: level, startTime: performance.now(), duration: 400 })
            }
          }
          updateControllerSegSprites(existing, level, progress, progressTotal)
        } else if (existing.__ctrlSegGraphics) {
          drawControllerSegments(existing.__ctrlSegGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CTRL_SEG_OUT, CTRL_SEG_IN, level, progress, progressTotal)
        }
        existing.__ctrlLevel         = level
        existing.__ctrlProgress      = progress
        existing.__ctrlProgressTotal = progressTotal
      }
      const newDt = typeof obj.downgradeTime === 'number' ? obj.downgradeTime : undefined
      if (existing.__ctrlDowngradeTime !== newDt) existing.__ctrlDowngradeTime = newDt
    }
    if (obj.type === 'source') {
      const { energy, capacity } = getSourceEnergy(obj)
      if (existing.__sourceEnergy !== energy || existing.__sourceCapacity !== capacity) {
        this.startSourceAnimation(id, existing, existing.__sourceEnergy ?? 0, existing.__sourceCapacity ?? capacity, energy, capacity)
        existing.__sourceEnergy = energy
        existing.__sourceCapacity = capacity
      }
    }
    if (obj.type === 'constructionSite') {
      const progress      = typeof obj.progress      === 'number' ? obj.progress      : 0
      const progressTotal = typeof obj.progressTotal === 'number' ? obj.progressTotal : 1
      if (existing.__csProgress !== progress || existing.__csProgressTotal !== progressTotal) {
        if (existing.__csFillGraphics) {
          drawCSProgress(existing.__csFillGraphics, TILE_SIZE / 2, TILE_SIZE / 2, CS_FILL_R, progress, progressTotal, existing.__csColor ?? CS_OWN)
        }
        existing.__csProgress      = progress
        existing.__csProgressTotal = progressTotal
      }
    }
    if (obj.type === 'powerBank') {
      const power = getPowerBankPower(obj)
      if (existing.__powerBankPower !== power) {
        existing.__powerBankPower = power
        existing.__powerBankRadius = calcPowerBankRadius(power)
      }
    }
  }

  /**
   * Drop and re-create every visual whose type the server now describes, plus any
   * that was built from a description the server no longer publishes (a
   * disconnect, or a switch to a server without the mod).
   */
  private rebuildCustomVisuals(): void {
    for (const [id, visual] of [...this.objects]) {
      const obj = this.rawObjects.get(id)
      if (!obj) continue
      const wasCustom = visual.__customVisual !== undefined
      const isCustom = customObjectMetadata(obj.type) !== undefined
      if (!wasCustom && !isCustom) continue
      this.container.removeChild(visual)
      destroyVisual(visual)
      this.objects.delete(id)
      this.createVisual(id, obj)
    }
  }

  update(objects: RoomObjectMap, diff?: RoomObjectDiff, users?: Record<string, { _id: string; username: string; badge?: Badge }>, gameTime?: number): void {
    // Server render metadata arrives with /api/version, which usually settles
    // after the first room has drawn — so anything that fell back to a plain
    // rectangle gets rebuilt once the description for its type shows up.
    const rev = customRendererRevision()
    if (rev !== this.customRendererRev) {
      this.customRendererRev = rev
      this.rebuildCustomVisuals()
    }
    if (users) {
      this.users = users
    }
    if (gameTime !== undefined) {
      // Stamp the wall-clock start of each new tick so the cooldown pulse can align to it.
      if (gameTime !== this.currentGameTime) this.lastTickAt = performance.now()
      this.currentGameTime = gameTime
    }
    let roadsChanged = false
    let wallsChanged = false
    let rampartsChanged = false

    if (diff) {
      // Use for...in over Object.entries to avoid array allocation per tick
      for (const id in diff) {
        const changes = diff[id]
        if (changes === null) {
          const oldObj = this.rawObjects.get(id)
          if (oldObj && oldObj.type === 'road') roadsChanged = true
          if (oldObj && oldObj.type === 'constructedWall') wallsChanged = true
          if (oldObj && oldObj.type === 'rampart') rampartsChanged = true

          const visual = this.objects.get(id)
          if (visual) {
            this.container.removeChild(visual)
            destroyVisual(visual)
            this.objects.delete(id)
            this.rawObjects.delete(id)
            this.fillAnimations.delete(id)
            this.buildGlowAnimations.delete(id)
            this.ctrlFlashAnimations.delete(id)
            this.sayBubbles.delete(id)
          }
        } else {
          const obj = objects[id]
          if (!obj) continue
          
          if (obj.type === 'road') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y) {
              roadsChanged = true
            }
          } else if (obj.type === 'constructedWall') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y) {
              wallsChanged = true
            }
          } else if (obj.type === 'rampart') {
            const existing = this.rawObjects.get(id)
            if (!existing || existing.x !== obj.x || existing.y !== obj.y || existing.user !== obj.user) {
              rampartsChanged = true
            }
          }

          this.rawObjects.set(id, obj)
          const existing = this.objects.get(id)
          if (!existing) {
            this.createVisual(id, obj)
          } else {
            this.updateExistingVisual(id, obj, existing, false)
          }
        }
      }
    } else {
      const seen = new Set<string>()

      // Use for...in to prevent unnecessary array allocation
      for (const id in objects) {
        const obj = objects[id]
        if (!obj) continue

        seen.add(id)
        this.rawObjects.set(id, obj)
        const existing = this.objects.get(id)
        if (!existing) {
          this.createVisual(id, obj)
        } else {
          this.updateExistingVisual(id, obj, existing, true)
        }
      }

      // Remove objects that no longer exist
      for (const [id, visual] of this.objects) {
        if (!seen.has(id)) {
          this.container.removeChild(visual)
          destroyVisual(visual)
          this.objects.delete(id)
          this.rawObjects.delete(id)
          this.fillAnimations.delete(id)
          this.buildGlowAnimations.delete(id)
          this.ctrlFlashAnimations.delete(id)
          this.sayBubbles.delete(id)
        }
      }

      roadsChanged = true
      wallsChanged = true
      rampartsChanged = true
    }

    if (wallsChanged) {
      this.redrawWalls()
    }
    if (rampartsChanged) {
      this.redrawRamparts()
    }
    if (roadsChanged) {
      this.redrawRoads()
    }

    this.refreshDisabled()

    // Drive every spawn's progress ring from the local game clock. Re-sync the
    // completion tick only when the spawning payload changes (the server doesn't
    // reliably re-send remainingTime each tick), then advance locally so the ring
    // keeps progressing every tick instead of freezing between server updates.
    for (const [id, visual] of this.objects) {
      if (!visual.__spawnRing) continue
      const obj = this.rawObjects.get(id)
      const sig = obj ? spawnSig(obj) : null
      if (sig !== visual.__spawnSig) {
        visual.__spawnSig = sig
        const t = obj && sig ? spawnTiming(obj, this.currentGameTime) : null
        visual.__spawnNeedTime = t?.needTime
        visual.__spawnEndTime = t?.endTime
      }
      const ratio = visual.__spawnNeedTime !== undefined && visual.__spawnEndTime !== undefined
        ? spawnRatio(visual.__spawnNeedTime, visual.__spawnEndTime, this.currentGameTime)
        : null
      if (ratio !== visual.__spawnRatio) {
        drawSpawnRing(visual.__spawnRing, ratio)
        visual.__spawnRatio = ratio
      }
      // Tween the inner energy disc when stored energy changes (same loop already
      // has `obj` to hand, so both diff/full update paths stay covered here).
      if (obj) {
        const { energy, capacity } = getExtensionEnergy(obj)
        if (visual.__spawnEnergy !== energy || visual.__spawnCapacity !== capacity) {
          this.startSpawnFillAnimation(id, visual, visual.__spawnEnergy ?? 0, visual.__spawnCapacity ?? capacity, energy, capacity)
          visual.__spawnEnergy = energy
          visual.__spawnCapacity = capacity
        }
      }
    }

    this.refreshForeignCreepLabels()
    this.refreshForeignCreepBadges()
  }

  /**
   * Recompute which structures the controller currently keeps switched off and
   * repaint the wash. Only touches the Graphics when the tile set actually changed —
   * the controller level and structure counts move rarely, this runs every tick.
   */
  private refreshDisabled(): void {
    const disabled = computeDisabledIds(this.rawObjects)
    const tiles: Array<{ x: number; y: number }> = []
    for (const id of disabled) {
      const obj = this.rawObjects.get(id)
      if (obj) tiles.push({ x: obj.x, y: obj.y })
    }
    tiles.sort((a, b) => a.y - b.y || a.x - b.x)
    const sig = tiles.map((t) => `${t.x},${t.y}`).join(' ')
    if (sig === this.disabledSig) return
    this.disabledSig = sig
    drawDisabledTiles(this.disabledGraphics, tiles, TILE_SIZE)
    if (sig === '') this.disabledGraphics.alpha = 0
  }

  private redrawWalls(): void {
    this.wallGraphics.clear()
    this.wallMarkGraphics.clear()

    const T = TILE_SIZE
    const R = T / 2
    const grid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    const walls: Array<{ x: number; y: number }> = []

    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'constructedWall' && typeof obj.x === 'number' && typeof obj.y === 'number' &&
          obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
        grid[obj.x][obj.y] = true
        walls.push({ x: obj.x, y: obj.y })
      }
    }

    if (walls.length === 0) return

    const drawQuadrants = (g: Graphics) => {
      let drawn = false
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          const center = grid[x][y]
          const top    = y > 0  && grid[x][y - 1]
          const bottom = y < 49 && grid[x][y + 1]
          const left   = x > 0  && grid[x - 1][y]
          const right  = x < 49 && grid[x + 1][y]
          const cx = x * T + R
          const cy = y * T + R

          // Top-Left
          if (center) {
            drawn = true
            if (!top && !left && y > 0 && x > 0) {
              g.moveTo(cx, y * T); g.arc(cx, cy, R, -Math.PI / 2, Math.PI, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(x * T, y * T, R, R)
            }
          } else if (top && left && grid[x - 1][y - 1]) {
            drawn = true
            g.moveTo(cx, y * T); g.lineTo(x * T, y * T); g.lineTo(x * T, cy)
            g.arc(cx, cy, R, Math.PI, -Math.PI / 2, false); g.closePath()
          }

          // Top-Right
          if (center) {
            if (!top && !right && y > 0 && x < 49) {
              g.moveTo(cx, y * T); g.arc(cx, cy, R, -Math.PI / 2, 0, false); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(cx, y * T, R, R)
            }
          } else if (top && right && grid[x + 1][y - 1]) {
            drawn = true
            g.moveTo(cx, y * T); g.lineTo(x * T + T, y * T); g.lineTo(x * T + T, cy)
            g.arc(cx, cy, R, 0, -Math.PI / 2, true); g.closePath()
          }

          // Bottom-Left
          if (center) {
            if (!bottom && !left && y < 49 && x > 0) {
              g.moveTo(x * T, cy); g.arc(cx, cy, R, Math.PI, Math.PI / 2, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(x * T, cy, R, R)
            }
          } else if (bottom && left && grid[x - 1][y + 1]) {
            drawn = true
            g.moveTo(x * T, cy); g.lineTo(x * T, y * T + T); g.lineTo(cx, y * T + T)
            g.arc(cx, cy, R, Math.PI / 2, Math.PI, false); g.closePath()
          }

          // Bottom-Right
          if (center) {
            if (!bottom && !right && y < 49 && x < 49) {
              g.moveTo(cx, y * T + T); g.arc(cx, cy, R, Math.PI / 2, 0, true); g.lineTo(cx, cy); g.closePath()
            } else {
              g.rect(cx, cy, R, R)
            }
          } else if (bottom && right && grid[x + 1][y + 1]) {
            drawn = true
            g.moveTo(cx, y * T + T); g.lineTo(x * T + T, y * T + T); g.lineTo(x * T + T, cy)
            g.arc(cx, cy, R, 0, Math.PI / 2, false); g.closePath()
          }
        }
      }
      return drawn
    }

    const borderStroke = { color: TERRAIN_WALL_BORDER, width: T * 0.06, alignment: 0 as const, cap: 'round' as const, join: 'round' as const }
    if (drawQuadrants(this.wallGraphics)) this.wallGraphics.stroke(borderStroke)
    drawQuadrants(this.wallGraphics)
    this.wallGraphics.fill(this.wallColor)

    // Dash marks — two staggered short dashes per tile to distinguish from terrain walls
    const dashW = T * 0.32
    const dashH = T * 0.09
    for (const { x, y } of walls) {
      const tx = x * T
      const ty = y * T
      this.wallMarkGraphics.rect(tx + T * 0.12, ty + T * 0.30, dashW, dashH)
      this.wallMarkGraphics.rect(tx + T * 0.56, ty + T * 0.58, dashW, dashH)
    }
    this.wallMarkGraphics.fill({ color: 0x404040 })
  }

  private redrawRoads(): void {
    this.roadGraphics.clear()
    const color = this.roadColor

    const roadGrid = Array.from({ length: 50 }, () => new Array(50).fill(false))
    const roads: RoomObject[] = []

    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'road') {
        roads.push(obj)
        if (obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
          roadGrid[obj.x][obj.y] = true
        }
      }
    }

    if (roads.length === 0) return

    const cxOffset = TILE_SIZE / 2
    const cyOffset = TILE_SIZE / 2
    const radius = TILE_SIZE * 0.125

    // Draw center dots
    for (const r of roads) {
      this.roadGraphics.circle(r.x * TILE_SIZE + cxOffset, r.y * TILE_SIZE + cyOffset, radius)
    }
    this.roadGraphics.fill(color)

    // Draw connections
    const neighbors = [
      [1, 0],   // right
      [1, 1],   // bottom-right
      [0, 1],   // bottom
      [-1, 1],  // bottom-left
    ]

    for (const r of roads) {
      const cx = r.x * TILE_SIZE + cxOffset
      const cy = r.y * TILE_SIZE + cyOffset

      for (const [dx, dy] of neighbors) {
        const nx = r.x + dx
        const ny = r.y + dy
        if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && roadGrid[nx][ny]) {
          const ncx = nx * TILE_SIZE + cxOffset
          const ncy = ny * TILE_SIZE + cyOffset
          this.roadGraphics.moveTo(cx, cy)
          this.roadGraphics.lineTo(ncx, ncy)
        }
      }
    }
    this.roadGraphics.stroke({ width: radius * 2, color })
  }

  private redrawRamparts(): void {
    this.rampartGraphics.clear()
    this.rampartGlowGraphics.clear()
    const T = TILE_SIZE
    const R = T / 2

    const grid = Array.from({ length: 50 }, () => new Array<string | undefined>(50).fill(undefined))
    for (const obj of this.rawObjects.values()) {
      if (obj.type === 'rampart' && obj.x >= 0 && obj.x < 50 && obj.y >= 0 && obj.y < 50) {
        grid[obj.x][obj.y] = typeof obj.user === 'string' ? obj.user : undefined
      }
    }

    // Drawn on top of structures as a uniform translucent green wash (vanilla overlay):
    // one alpha for every tile, so a ramparted structure simply reads through as a green
    // tint. Varying alpha per tile (faint over structures, bright over terrain) drew a
    // visible darker square around each structure where the two alphas met.
    const rampartColor = (user: string | undefined): { color: number; alpha: number } => {
      if (!user || !this.currentUserId) return { color: ST_RAMPART, alpha: 0.4 }
      return user === this.currentUserId
        ? { color: ST_RAMPART, alpha: 0.4 }
        : { color: ST_RAMPART_ENEMY, alpha: 0.36 }
    }

    // Glowing perimeter rim hugging each rampart blob, grouped by owner category so
    // own/neutral get a green rim and foreign ramparts a red one. Drawn on top of the
    // fills (below) as a multi-pass soft glow — see strokeBorder.
    const greenGrid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    const redGrid = Array.from({ length: 50 }, () => new Array<boolean>(50).fill(false))
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const u = grid[x][y]
        if (u === undefined) continue
        if (!this.currentUserId || u === this.currentUserId) greenGrid[x][y] = true
        else redGrid[x][y] = true
      }
    }

    const strokeBorder = (bgrid: boolean[][], color: number) => {
      // Trace the outer perimeter path of every blob onto `g` — rounded convex
      // corners, rounded concave notches, and exposed straight tile edges. Interior
      // quadrant boundaries are skipped so the translucent fill stays clean. Returns
      // false if nothing was emitted. PixiJS consumes the path on stroke(), so each
      // target re-traces it.
      const trace = (g: Graphics): boolean => {
        let drawn = false
        const seg = (x0: number, y0: number, x1: number, y1: number) => {
          g.moveTo(x0, y0); g.lineTo(x1, y1); drawn = true
        }
        const arc = (sx: number, sy: number, a0: number, a1: number, ccw: boolean, cxc: number, cyc: number) => {
          g.moveTo(sx, sy); g.arc(cxc, cyc, R, a0, a1, ccw); drawn = true
        }
        for (let y = 0; y < 50; y++) {
          for (let x = 0; x < 50; x++) {
            const top    = y > 0  && bgrid[x][y - 1]
            const bottom = y < 49 && bgrid[x][y + 1]
            const left   = x > 0  && bgrid[x - 1][y]
            const right  = x < 49 && bgrid[x + 1][y]
            const dTL = x > 0  && y > 0  && bgrid[x - 1][y - 1]
            const dTR = x < 49 && y > 0  && bgrid[x + 1][y - 1]
            const dBL = x > 0  && y < 49 && bgrid[x - 1][y + 1]
            const dBR = x < 49 && y < 49 && bgrid[x + 1][y + 1]
            const cx = x * T + R
            const cy = y * T + R
            if (bgrid[x][y]) {
              // Convex corners round; straight half-edges otherwise. A half-edge that
              // runs into a concave corner (rounded by a diagonal empty tile's arc) is
              // suppressed so it stops at the arc instead of overshooting to a sharp point.
              // Top-Left
              if (!top && !left && y > 0 && x > 0) arc(cx, y * T, -Math.PI / 2, Math.PI, true, cx, cy)
              else { if (!top && !(left && dTL)) seg(x * T, y * T, cx, y * T); if (!left && !(top && dTL)) seg(x * T, y * T, x * T, cy) }
              // Top-Right
              if (!top && !right && y > 0 && x < 49) arc(cx, y * T, -Math.PI / 2, 0, false, cx, cy)
              else { if (!top && !(right && dTR)) seg(cx, y * T, x * T + T, y * T); if (!right && !(top && dTR)) seg(x * T + T, y * T, x * T + T, cy) }
              // Bottom-Left
              if (!bottom && !left && y < 49 && x > 0) arc(x * T, cy, Math.PI, Math.PI / 2, true, cx, cy)
              else { if (!bottom && !(left && dBL)) seg(x * T, y * T + T, cx, y * T + T); if (!left && !(bottom && dBL)) seg(x * T, cy, x * T, y * T + T) }
              // Bottom-Right
              if (!bottom && !right && y < 49 && x < 49) arc(cx, y * T + T, Math.PI / 2, 0, true, cx, cy)
              else { if (!bottom && !(right && dBR)) seg(cx, y * T + T, x * T + T, y * T + T); if (!right && !(bottom && dBR)) seg(x * T + T, cy, x * T + T, y * T + T) }
            } else {
              // Rounded concave notches around an empty tile cornered by ramparts
              if (top && left && dTL) arc(x * T, cy, Math.PI, -Math.PI / 2, false, cx, cy)
              if (top && right && dTR) arc(x * T + T, cy, 0, -Math.PI / 2, true, cx, cy)
              if (bottom && left && dBL) arc(cx, y * T + T, Math.PI / 2, Math.PI, false, cx, cy)
              if (bottom && right && dBR) arc(x * T + T, cy, 0, Math.PI / 2, false, cx, cy)
            }
          }
        }
        return drawn
      }
      // butt caps (not round): the perimeter is emitted as disjoint per-tile segments,
      // so round caps would stack a half-circle at every shared endpoint and bead the
      // line. Adjacent segments are collinear/tangent, so butt caps meet flush.
      // Wide bright stroke on the blurred glow layer (below the fills) → a soft glow
      // that haloes past the blob edge and tints up through the translucent fill.
      if (trace(this.rampartGlowGraphics)) this.rampartGlowGraphics.stroke({ color, width: T * 0.3, alpha: 0.35, alignment: 0.5, cap: 'butt', join: 'round' })
      // Crisp core rim on top of the fills.
      if (trace(this.rampartGraphics)) this.rampartGraphics.stroke({ color, width: T * 0.08, alpha: 0.9, alignment: 0.5, cap: 'butt', join: 'round' })
    }

    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const centerUser = grid[x][y]
        const center = centerUser !== undefined
        const top = y > 0 && grid[x][y - 1] !== undefined
        const bottom = y < 49 && grid[x][y + 1] !== undefined
        const left = x > 0 && grid[x - 1][y] !== undefined
        const right = x < 49 && grid[x + 1][y] !== undefined

        const cx = x * T + R
        const cy = y * T + R

        // Top-Left Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!top && !left && y > 0 && x > 0) {
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.arc(cx, cy, R, -Math.PI / 2, Math.PI, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(x * T, y * T, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (top && left && grid[x - 1][y - 1] !== undefined) {
            const color = rampartColor(grid[x - 1][y - 1])
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.lineTo(x * T, y * T)
            this.rampartGraphics.lineTo(x * T, cy)
            this.rampartGraphics.arc(cx, cy, R, Math.PI, -Math.PI / 2, false)
            this.rampartGraphics.fill(color)
          }
        }

        // Top-Right Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!top && !right && y > 0 && x < 49) {
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.arc(cx, cy, R, -Math.PI / 2, 0, false)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(cx, y * T, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (top && right && grid[x + 1][y - 1] !== undefined) {
            const color = rampartColor(grid[x + 1][y - 1])
            this.rampartGraphics.moveTo(cx, y * T)
            this.rampartGraphics.lineTo(x * T + T, y * T)
            this.rampartGraphics.lineTo(x * T + T, cy)
            this.rampartGraphics.arc(cx, cy, R, 0, -Math.PI / 2, true)
            this.rampartGraphics.fill(color)
          }
        }

        // Bottom-Left Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!bottom && !left && y < 49 && x > 0) {
            this.rampartGraphics.moveTo(x * T, cy)
            this.rampartGraphics.arc(cx, cy, R, Math.PI, Math.PI / 2, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(x * T, cy, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (bottom && left && grid[x - 1][y + 1] !== undefined) {
            const color = rampartColor(grid[x - 1][y + 1])
            this.rampartGraphics.moveTo(x * T, cy)
            this.rampartGraphics.lineTo(x * T, y * T + T)
            this.rampartGraphics.lineTo(cx, y * T + T)
            this.rampartGraphics.arc(cx, cy, R, Math.PI / 2, Math.PI, false)
            this.rampartGraphics.fill(color)
          }
        }

        // Bottom-Right Quadrant
        if (center) {
          const color = rampartColor(centerUser)
          if (!bottom && !right && y < 49 && x < 49) {
            this.rampartGraphics.moveTo(cx, y * T + T)
            this.rampartGraphics.arc(cx, cy, R, Math.PI / 2, 0, true)
            this.rampartGraphics.lineTo(cx, cy)
            this.rampartGraphics.fill(color)
          } else {
            this.rampartGraphics.rect(cx, cy, R, R)
            this.rampartGraphics.fill(color)
          }
        } else {
          if (bottom && right && grid[x + 1][y + 1] !== undefined) {
            const color = rampartColor(grid[x + 1][y + 1])
            this.rampartGraphics.moveTo(cx, y * T + T)
            this.rampartGraphics.lineTo(x * T + T, y * T + T)
            this.rampartGraphics.lineTo(x * T + T, cy)
            this.rampartGraphics.arc(cx, cy, R, 0, Math.PI / 2, false)
            this.rampartGraphics.fill(color)
          }
        }
      }
    }

    // Brighter perimeter rim drawn on top of the fills
    strokeBorder(greenGrid, ST_RAMPART_STROKE)
    strokeBorder(redGrid, ST_RAMPART_ENEMY_STROKE)
  }

  /**
   * Return all objects whose tile position matches (tx, ty).
   * For creeps the tile is derived from their *target* (data) position, not
   * the interpolated visual position, so selection is consistent.
   */
  getObjectsAtTile(tx: number, ty: number): ObjectEntry[] {
    const result: ObjectEntry[] = []
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj) continue
      if (obj.x === tx && obj.y === ty) {
        result.push({ id, obj, visual })
      }
    }
    return result
  }

  /**
   * Apply the current world-scale to a visual's name label.
   * Run after creating a visual so newly-spawned creeps get the right label scale
   * even when the room is already zoomed (lastWorldScale ≠ 1).
   */
  private applyLabelScale(visual: ContainerWithTarget): void {
    const worldScale = this.lastWorldScale || 1
    visual.__customVisual?.setWorldScale(worldScale)
    if (visual.__nameLabel) {
      visual.__nameLabel.scale.set(LABEL_FONT_SCALE / worldScale)
      if (visual.__nameLabel.anchor.y === 0) {
        // Flag label — anchored at top, positioned below the flag
        visual.__nameLabel.y = TILE_SIZE / 2 + TILE_SIZE * 0.55
      } else {
        // Creep label — anchored at bottom, positioned above the creep
        visual.__nameLabel.y = LABEL_CREEP_TOP - LABEL_GAP_PX / worldScale
      }
    }
    if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
      // Pivot is at tail tip; place tail tip just above the creep with a fixed screen-pixel gap.
      visual.__sayBubble.scale.set(1 / worldScale)
      visual.__sayBubble.position.set(TILE_SIZE / 2, LABEL_CREEP_TOP - SAY_GAP_PX / worldScale)
    }
  }

  /**
   * Refresh foreign-creep labels from the current users map. When a foreign creep
   * spawns into an already-watched room the users map may not yet contain the
   * owner's username; once it does, we update the label from <userId> to <username>.
   */
  private refreshForeignCreepLabels(): void {
    if (!this.currentUserId) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'creep') continue
      if (!visual.__nameLabel) continue
      if (!isForeignCreep(obj, this.currentUserId)) continue
      const userId = typeof obj.user === 'string' ? obj.user : undefined
      const labelText = npcCreepName(obj, this.users) ?? (userId ? (this.users?.[userId]?.username ?? userId) : 'Hostile')
      if (visual.__nameLabel.text !== labelText) {
        visual.__nameLabel.text = labelText
      }
    }
  }

  /**
   * Add badge sprites to foreign creeps whose user data (including badge) arrived
   * after the visual was initially created. Replaces the red foreign-mark fill
   * with the proper badge once the badge texture is resolved.
   */
  private refreshForeignCreepBadges(): void {
    if (!this.currentUserId) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'creep') continue
      if (!isForeignCreep(obj, this.currentUserId)) continue
      if (visual.__creepBadgeSprite) continue  // badge already wired up
      const creepUserId = typeof obj.user === 'string' ? obj.user : undefined
      const creepBadge = creepUserId ? this.users?.[creepUserId]?.badge : undefined
      if (!creepBadge) continue
      const bodyContainer = visual.__bodyContainer
      if (!bodyContainer) continue

      // Remove the red foreign-mark placeholder if present
      if (visual.__creepForeignMark && !visual.__creepForeignMark.destroyed) {
        bodyContainer.removeChild(visual.__creepForeignMark)
        visual.__creepForeignMark.destroy()
        visual.__creepForeignMark = undefined
      }

      const badgeSprite = new Sprite()
      badgeSprite.anchor.set(0.5, 0.5)
      const size = CREEP_INNER_R * 2
      badgeSprite.width = size
      badgeSprite.height = size
      // Wired up after the creep already exists, so match whatever heading it holds.
      badgeSprite.rotation = -bodyContainer.rotation
      bodyContainer.addChild(badgeSprite)
      visual.__creepBadgeSprite = badgeSprite
      this.badgeCache.getOrCreate(creepBadge as Badge).then((texture) => {
        if (!badgeSprite.destroyed) badgeSprite.texture = texture
      }).catch(() => {
        if (!badgeSprite.destroyed) {
          bodyContainer.removeChild(badgeSprite)
          badgeSprite.destroy()
        }
        visual.__creepBadgeSprite = undefined
      })
    }
  }

  /** Trigger the yellow build-glow on the construction site at the given tile, if any. */
  triggerBuildAt(tx: number, ty: number, durationMs: number): void {
    if (this.instantMode) return
    for (const [id, visual] of this.objects) {
      const obj = this.rawObjects.get(id)
      if (!obj || obj.type !== 'constructionSite') continue
      if (obj.x !== tx || obj.y !== ty) continue
      if (!visual.__csBuildGlow) continue
      this.buildGlowAnimations.set(id, { startTime: performance.now(), duration: durationMs })
      return
    }
  }

  /**
   * Aim a tower's barrel at a target tile and hold there for `durationMs` (the
   * action beam duration). When the hold expires the idle sweep resumes from the
   * current angle. No-op in instant/history mode.
   */
  triggerTowerAim(id: string, tx: number, ty: number, durationMs: number): void {
    if (this.instantMode) return
    const visual = this.objects.get(id)
    if (!visual || !visual.__barrelContainer) return
    const obj = this.rawObjects.get(id)
    if (!obj) return
    const dx = tx - obj.x
    const dy = ty - obj.y
    if (dx === 0 && dy === 0) return
    visual.__towerAimAngle = Math.atan2(dy, dx) + TOWER_BARREL_FORWARD
    visual.__towerAimUntil = performance.now() + durationMs
  }

  /**
   * Show a speech bubble above the given creep. Lifetime is governed by the
   * caller — see pruneSayBubblesExcept(). Calling with the same message for a
   * creep already showing a bubble is a no-op (no destroy/recreate flicker).
   */
  triggerSay(creepId: string, message: string): void {
    const visual = this.objects.get(creepId)
    if (!visual) return

    if (visual.__sayMessage === message && visual.__sayBubble && !visual.__sayBubble.destroyed) {
      return
    }

    if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
      visual.removeChild(visual.__sayBubble)
      destroyTree(visual.__sayBubble)
    }

    const bubble = buildSayBubble(message)
    visual.addChild(bubble)
    visual.__sayBubble = bubble
    visual.__sayMessage = message
    this.applyLabelScale(visual)
    this.sayBubbles.add(creepId)
  }

  /** Duration (ms) that creep movement interpolations should span. */
  setMoveDuration(ms: number): void {
    this.moveDuration = Math.max(0, ms)
  }

  // Full tick duration in ms — drives the lab cooldown pulse so one breath spans one tick
  // (vanilla pulses per tick; a fixed wall-clock period would diverge at off-nominal tick rates).
  setTickDuration(ms: number): void {
    this.tickMs = Math.max(1, ms)
  }

  /**
   * Remove say bubbles for creeps that did *not* speak this tick. The only
   * lifecycle signal for bubbles — called from RoomViewer after the per-tick
   * actionLog loop, so the bubble is on while the creep is in `activeSayers`
   * and off otherwise. No timers involved.
   */
  pruneSayBubblesExcept(activeSayers: ReadonlySet<string>): void {
    if (this.sayBubbles.size === 0) return
    for (const id of this.sayBubbles) {
      if (activeSayers.has(id)) continue
      const visual = this.objects.get(id)
      if (visual?.__sayBubble && !visual.__sayBubble.destroyed) {
        visual.removeChild(visual.__sayBubble)
        destroyTree(visual.__sayBubble)
      }
      if (visual) {
        visual.__sayBubble = undefined
        visual.__sayMessage = undefined
      }
      this.sayBubbles.delete(id)
    }
  }

  setInstantMode(enabled: boolean): void {
    this.instantMode = enabled
    if (!enabled) return
    for (const visual of this.objects.values()) {
      if (visual.__targetX !== undefined) {
        visual.position.set(visual.__targetX, visual.__targetY!)
        visual.__targetX = undefined
        visual.__targetY = undefined
        visual.__moveStartX = undefined
        visual.__moveStartY = undefined
        visual.__moveStartT = undefined
        visual.__moveDur = undefined
      }
      if (visual.__sayBubble && !visual.__sayBubble.destroyed) {
        visual.removeChild(visual.__sayBubble)
        destroyTree(visual.__sayBubble)
        visual.__sayBubble = undefined
        visual.__sayMessage = undefined
      }
    }
    this.sayBubbles.clear()
    for (const anim of this.fillAnimations.values()) anim.apply(anim.visual, anim.toA, anim.toB)
    this.fillAnimations.clear()
    this.buildGlowAnimations.clear()
    this.ctrlFlashAnimations.clear()
  }

  setShowLabels(show: boolean): void {
    this.showLabels = show
    for (const visual of this.objects.values()) {
      if (visual.__nameLabel) visual.__nameLabel.visible = show
    }
  }

  /** Return the live PixiJS container for an object by id, if present. */
  getVisualById(id: string): ContainerWithTarget | undefined {
    return this.objects.get(id)
  }

  clear(): void {
    for (const visual of this.objects.values()) {
      destroyVisual(visual)
    }
    this.objects.clear()
    this.rawObjects.clear()
    this.fillAnimations.clear()
    this.buildGlowAnimations.clear()
    this.ctrlFlashAnimations.clear()
    this.sayBubbles.clear()
    this.roadGraphics.clear()
    this.rampartGraphics.clear()
    this.rampartGlowGraphics.clear()
    this.wallGraphics.clear()
    this.wallMarkGraphics.clear()
    this.disabledGraphics.clear()
    this.disabledGraphics.alpha = 0
    this.disabledSig = ''
    this.container.removeChildren()
    // Re-attach persistent graphics layers removed by removeChildren(). rampartGraphics/
    // rampartGlowGraphics live in `rampartLayer`, not `container` — untouched by this call.
    this.container.addChild(this.wallGraphics)
    this.container.addChild(this.wallMarkGraphics)
    this.container.addChild(this.roadGraphics)
    this.container.addChild(this.disabledGraphics)
  }

  destroy(): void {
    this.clear()
    this.decorationAnimator?.destroy()
    this.decorationAnimator = null
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback)
    }
    this.ticker = null
    this.tickerCallback = null
    // clear() only empties the containers — the layer itself is replaced on every room
    // change, so the road/wall/rampart Graphics it keeps across ticks have to go with it.
    // Each holds a room-wide path; leaving them undestroyed strands that geometry on the
    // renderer until the whole PixiJS Application is torn down.
    destroyTree(this.container)
    destroyTree(this.rampartLayer)
  }
}
