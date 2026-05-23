import { Graphics } from 'pixi.js'
import type { Texture, Container } from 'pixi.js'
import { ST_DARK, ST_OUTLINE, ST_LIGHT } from './colors.js'
import { TILE_SIZE } from './RoomRenderer.js'

type PixiRenderer = { generateTexture(opts: { target: Container; resolution?: number }): Texture }

// Match ObjectLayer constants — both files must stay in sync
export const EXT_OUTER_R = TILE_SIZE * 0.42
export const EXT_INNER_R = TILE_SIZE * 0.30
export const EXT_STROKE_W = Math.max(1, TILE_SIZE * 0.08)

export class StructureTextureCache {
  private readonly cache = new Map<string, Texture>()
  private readonly renderer: PixiRenderer

  constructor(renderer: PixiRenderer) {
    this.renderer = renderer
  }

  getExtensionShell(isSmall: boolean): Texture {
    const key = isSmall ? 'ext-small' : 'ext-large'
    const cached = this.cache.get(key)
    if (cached) return cached

    const scale = isSmall ? 0.6 : 1.0
    const outerR = EXT_OUTER_R * scale
    const innerR = EXT_INNER_R * scale
    const strokeW = EXT_STROKE_W * scale
    const center = outerR + strokeW

    const g = new Graphics()
    g.circle(center, center, outerR)
    g.fill(ST_DARK)
    g.circle(center, center, outerR)
    g.stroke({ width: strokeW, color: ST_OUTLINE })
    g.circle(center, center, innerR)
    g.fill(ST_LIGHT)

    const resolution = Math.max(2, window.devicePixelRatio || 1)
    const texture = this.renderer.generateTexture({ target: g, resolution })
    g.destroy()
    this.cache.set(key, texture)
    return texture
  }

  destroy(): void {
    for (const tex of this.cache.values()) {
      if (!tex.destroyed) tex.destroy(true)
    }
    this.cache.clear()
  }
}
