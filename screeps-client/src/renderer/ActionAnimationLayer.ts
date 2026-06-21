import { Container, Graphics, Ticker } from 'pixi.js'
import { TILE_SIZE } from './RoomRenderer.js'
import { ANIM_HARVEST, ANIM_UPGRADE, ANIM_BUILD, ANIM_REPAIR, ANIM_TRANSFER, ANIM_LINK_TRANSFER, ANIM_TOWER_ATTACK, ANIM_TOWER_HEAL, ANIM_TOWER_REPAIR } from './colors.js'

interface BeamAnimation {
  fromX: number
  fromY: number
  toX: number
  toY: number
  startTime: number
  duration: number
  color: number
  width: number
  glowAtSource?: boolean  // glow the source end instead of the target (harvest points source → creep)
}

const BEAM_WIDTH = 2
const TOWER_BEAM_WIDTH = 3  // tower beams read as a heavier shot than creep action beams
const GLOW_RADIUS = TILE_SIZE * 0.45  // base impact-glow radius; tower beams scale it up by their wider stroke
const GLOW_ALPHA = 0.55               // peak opacity of the impact-glow core

function tileCenter(x: number, y: number): { cx: number; cy: number } {
  return {
    cx: x * TILE_SIZE + TILE_SIZE / 2,
    cy: y * TILE_SIZE + TILE_SIZE / 2,
  }
}

export class ActionAnimationLayer {
  readonly container: Container
  private graphics: Graphics
  private animations: BeamAnimation[] = []
  private ticker: Ticker | null = null
  private tickerCallback: (() => void) | null = null

  constructor(ticker?: Ticker) {
    this.container = new Container()
    this.graphics = new Graphics()
    this.container.addChild(this.graphics)

    if (ticker) {
      this.ticker = ticker
      this.tickerCallback = () => this.animate()
      ticker.add(this.tickerCallback)
    }
  }

  addHarvest(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_HARVEST,
      width: BEAM_WIDTH,
      glowAtSource: true,  // harvest points source → creep; glow the source, not the creep
    })
  }

  addUpgradeController(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_UPGRADE,
      width: BEAM_WIDTH,
    })
  }

  addTransfer(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_TRANSFER,
      width: BEAM_WIDTH,
    })
  }

  addBuild(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_BUILD,
      width: BEAM_WIDTH,
    })
  }

  // Creep repair: same build/hold/dissolve beam as the build action, driven by the
  // creep's actionLog.repair (target structure position).
  addRepair(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_REPAIR,
      width: BEAM_WIDTH,
    })
  }

  // Link-to-link energy transfer: source link → destination link. Same build/hold/dissolve
  // beam as the build action, driven by the source link's actionLog.transferEnergy.
  addLinkTransfer(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color: ANIM_LINK_TRANSFER,
      width: BEAM_WIDTH,
    })
  }

  private addTowerBeam(fromX: number, fromY: number, toX: number, toY: number, durationMs: number, color: number): void {
    const from = tileCenter(fromX, fromY)
    const to = tileCenter(toX, toY)
    this.animations.push({
      fromX: from.cx,
      fromY: from.cy,
      toX: to.cx,
      toY: to.cy,
      startTime: performance.now(),
      duration: durationMs,
      color,
      width: TOWER_BEAM_WIDTH,
    })
  }

  addTowerAttack(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    this.addTowerBeam(fromX, fromY, toX, toY, durationMs, ANIM_TOWER_ATTACK)
  }

  addTowerHeal(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    this.addTowerBeam(fromX, fromY, toX, toY, durationMs, ANIM_TOWER_HEAL)
  }

  addTowerRepair(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): void {
    this.addTowerBeam(fromX, fromY, toX, toY, durationMs, ANIM_TOWER_REPAIR)
  }

  private animate(): void {
    this.graphics.clear()
    const now = performance.now()
    let anyActive = false

    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i]
      const elapsed = now - anim.startTime
      const progress = Math.min(1, elapsed / anim.duration)

      let startX: number
      let startY: number
      let endX: number
      let endY: number

      const buildRatio = 0.5
      const holdRatio = 0.2

      if (progress < buildRatio) {
        // Build phase: beam grows from source toward target
        const p = progress / buildRatio
        startX = anim.fromX
        startY = anim.fromY
        endX = anim.fromX + (anim.toX - anim.fromX) * p
        endY = anim.fromY + (anim.toY - anim.fromY) * p
      } else if (progress < buildRatio + holdRatio) {
        // Hold phase: full beam visible
        startX = anim.fromX
        startY = anim.fromY
        endX = anim.toX
        endY = anim.toY
      } else {
        // Dissolve phase: beam shrinks from the source (back) toward target
        const p = (progress - buildRatio - holdRatio) / (1 - buildRatio - holdRatio)
        startX = anim.fromX + (anim.toX - anim.fromX) * p
        startY = anim.fromY + (anim.toY - anim.fromY) * p
        endX = anim.toX
        endY = anim.toY
      }

      this.graphics.moveTo(startX, startY)
      this.graphics.lineTo(endX, endY)
      this.graphics.stroke({ width: anim.width, color: anim.color })

      // Vanilla-style round glow that flares as the beam lands, then fades out. Normally on the
      // target; harvest beams point source → creep, so they glow the source end instead.
      if (progress >= buildRatio) {
        const impactT = (progress - buildRatio) / (1 - buildRatio)
        const glowAlpha = (1 - impactT) * GLOW_ALPHA
        const glowRadius = (anim.width / BEAM_WIDTH) * GLOW_RADIUS * (0.7 + 0.5 * impactT)
        const glowX = anim.glowAtSource ? anim.fromX : anim.toX
        const glowY = anim.glowAtSource ? anim.fromY : anim.toY
        this.graphics.circle(glowX, glowY, glowRadius)
        this.graphics.fill({ color: anim.color, alpha: glowAlpha * 0.4 })
        this.graphics.circle(glowX, glowY, glowRadius * 0.55)
        this.graphics.fill({ color: anim.color, alpha: glowAlpha })
      }
      anyActive = true

      if (progress >= 1) {
        this.animations.splice(i, 1)
      }
    }

    if (!anyActive) {
      this.graphics.clear()
    }
  }

  clear(): void {
    this.animations.length = 0
    this.graphics.clear()
  }

  destroy(): void {
    this.clear()
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback)
    }
    this.ticker = null
    this.tickerCallback = null
    this.graphics.destroy()
    this.container.destroy()
  }
}
