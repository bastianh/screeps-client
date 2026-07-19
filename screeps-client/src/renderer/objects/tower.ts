import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { sharedAtlasCache } from '../AtlasCache.js'
import { defaultSpriteTheme } from '../themes/default.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_LIGHT, ST_ENERGY } from '../colors.js'
import { getExtensionEnergy } from './extension.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Tower visuals: rotating turret with an energy fill; aim/idle sweep constants for the ticker.
export const TOWER_BODY_X = -TILE_SIZE * 0.4
export const TOWER_BODY_Y = -TILE_SIZE * 0.3
export const TOWER_BODY_W = TILE_SIZE * 0.8
export const TOWER_BODY_H = TILE_SIZE * 0.6

export const TOWER_IDLE_SPEED = 0.4   // rad/s idle barrel sweep
export const TOWER_AIM_LERP   = 0.3   // per-frame fraction of remaining angle when turning to a target

// Barrel art points "up" (−y) at rotation 0, so a target at screen angle θ needs
// rotation θ + π/2. Flip the sign / drop the offset if the body sprite faces elsewhere.
export const TOWER_BARREL_FORWARD = Math.PI / 2

// Rotate `current` toward `target` by fraction `t`, taking the shortest path.
export function approachAngle(current: number, target: number, t: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  else if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * t
}

// Returns the fill level as a fraction [0,1] so the same value drives both the
// procedural-fallback rect and the atlas rounded-rect geometry.
export function calcTowerFillHeight(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return Math.min(1, energy / capacity)
}

export function updateTowerFill(visual: ContainerWithTarget, level: number): void {
  const fill = visual.__towerFillGraphics
  if (!fill) return
  fill.clear()
  if (level <= 0) return
  // Atlas tower: rounded-rect fill rising from the bottom of the body, in the
  // body's render-scaled coordinate space (geometry precomputed at load time).
  const geom = visual.__towerFillRect
  if (geom) {
    const h = geom.heightMax * level
    const y = geom.yMin + geom.heightMax - h
    const r = Math.min(geom.rx, geom.width / 2, h / 2)
    fill.roundRect(geom.x, y, geom.width, h, r)
    fill.fill(ST_ENERGY)
    return
  }
  // Procedural-fallback tower: plain rect inside the drawn body.
  const margin = Math.max(0.5, TILE_SIZE * 0.02)
  const h = TOWER_BODY_H * level
  fill.rect(TOWER_BODY_X + margin, TOWER_BODY_Y + TOWER_BODY_H - h + margin, TOWER_BODY_W - margin * 2, h - margin * 2)
  fill.fill(ST_ENERGY)
}
export function createTowerVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, outlineColor } = ctx
  const { energy: towerEnergy, capacity: towerCap } = getExtensionEnergy(obj)

  const towerSpec = defaultSpriteTheme.tower
  if (towerSpec) {
    const targetSize = TILE_SIZE * towerSpec.tileScale

    // Static ring (footprint, tinted by ownership)
    const ring = new Sprite()
    ring.anchor.set(0.5, 0.5)
    ring.position.set(cx, cy)
    ring.tint = outlineColor
    container.addChild(ring)

    // Rotating turret: body cannon + energy fill, pivot at tile center
    const turret = new Container()
    turret.position.set(cx, cy)
    container.addChild(turret)

    const body = new Sprite()
    body.anchor.set(0.5, 0.5)
    turret.addChild(body)

    const towerFill = new Graphics()
    turret.addChild(towerFill)

    ;(container as ContainerWithTarget).__barrelContainer = turret
    ;(container as ContainerWithTarget).__towerFillGraphics = towerFill
    ;(container as ContainerWithTarget).__towerEnergy = towerEnergy
    ;(container as ContainerWithTarget).__towerCapacity = towerCap

    // Scale both layers by the body's authored size so they stay aligned, and
    // map the fill geometry (atlas px) into the same render-scaled space.
    const applyScale = (tex: Texture) => {
      const ref = tex.orig?.width || tex.width
      const s = ref > 0 ? targetSize / ref : 1
      ring.scale.set(s)
      body.scale.set(s)
      ;(container as ContainerWithTarget).__towerFillRect = {
        x: towerSpec.fill.x * s,
        yMin: towerSpec.fill.yMin * s,
        width: towerSpec.fill.width * s,
        heightMax: towerSpec.fill.heightMax * s,
        rx: towerSpec.fill.rx * s,
        ry: towerSpec.fill.ry * s,
      }
      updateTowerFill(container as ContainerWithTarget, calcTowerFillHeight(towerEnergy, towerCap))
    }

    const ringTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, towerSpec.ringFrame)
    const bodyTex = sharedAtlasCache.getTexture(defaultSpriteTheme.atlasUrl, towerSpec.bodyFrame)
    if (ringTex && bodyTex) {
      ring.texture = ringTex
      body.texture = bodyTex
      applyScale(bodyTex)
    } else {
      sharedAtlasCache.getOrLoad(defaultSpriteTheme.atlasUrl).then(sheet => {
        if (!ring.destroyed) ring.texture = sheet.textures[towerSpec.ringFrame] ?? Texture.EMPTY
        if (!body.destroyed) {
          const t = sheet.textures[towerSpec.bodyFrame] ?? Texture.EMPTY
          body.texture = t
          if (!container.destroyed) applyScale(t)
        }
      }).catch(() => {})
    }
    return
  }

  // Static outer circle
  const towerBase = new Graphics()
  towerBase.circle(cx, cy, TILE_SIZE * 0.6)
  towerBase.fill(ST_DARK)
  towerBase.circle(cx, cy, TILE_SIZE * 0.6)
  towerBase.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  container.addChild(towerBase)

  // Rotating turret: body rect + energy fill + barrel — pivot at tile center
  const turret = new Container()
  turret.position.set(cx, cy)

  const towerBody = new Graphics()
  towerBody.rect(TOWER_BODY_X, TOWER_BODY_Y, TOWER_BODY_W, TOWER_BODY_H)
  towerBody.fill(ST_DARK)
  turret.addChild(towerBody)

  const towerFill = new Graphics()
  turret.addChild(towerFill)
  ;(container as ContainerWithTarget).__towerFillGraphics = towerFill as unknown as Graphics
  ;(container as ContainerWithTarget).__towerEnergy = towerEnergy
  ;(container as ContainerWithTarget).__towerCapacity = towerCap
  updateTowerFill(container as ContainerWithTarget, calcTowerFillHeight(towerEnergy, towerCap))

  const towerBorder = new Graphics()
  towerBorder.rect(TOWER_BODY_X, TOWER_BODY_Y, TOWER_BODY_W, TOWER_BODY_H)
  towerBorder.stroke({ width: 1, color: ST_GRAY })
  turret.addChild(towerBorder)

  const barrelG = new Graphics()
  barrelG.rect(-TILE_SIZE * 0.2, -TILE_SIZE * 0.9, TILE_SIZE * 0.4, TILE_SIZE * 0.5)
  barrelG.fill(ST_LIGHT)
  barrelG.rect(-TILE_SIZE * 0.2, -TILE_SIZE * 0.9, TILE_SIZE * 0.4, TILE_SIZE * 0.5)
  barrelG.stroke({ width: TILE_SIZE * 0.07, color: ST_DARK })
  turret.addChild(barrelG)

  container.addChild(turret)
  ;(container as ContainerWithTarget).__barrelContainer = turret
}
