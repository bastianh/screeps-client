import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY, ST_ENERGY } from '../colors.js'
import { spts } from './common.js'
import { getExtensionEnergy } from './extension.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Link visuals: diamond outline with an energy diamond core.
// Links show their energy as a diamond core that scales with stored energy,
// matching the link's diamond outline. The fraction is the linear scale of the
// inner diamond (half-extents below mirror the linkInner geometry in the draw).
export const LINK_FILL_DX = TILE_SIZE * 0.25
export const LINK_FILL_DY = TILE_SIZE * 0.30
export function calcLinkFillFraction(energy: number, capacity: number): number {
  if (capacity <= 0 || energy <= 0) return 0
  return Math.min(1, energy / capacity)
}
export function updateLinkFill(visual: ContainerWithTarget, fraction: number): void {
  const fill = visual.__linkFillGraphics
  if (!fill) return
  fill.clear()
  if (fraction <= 0) return
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  const dx = LINK_FILL_DX * fraction
  const dy = LINK_FILL_DY * fraction
  fill.poly([cx, cy - dy, cx + dx, cy, cx, cy + dy, cx - dx, cy])
  fill.fill(ST_ENERGY)
}
export function createLinkVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, outlineColor } = ctx
  const linkOuter = spts(cx, cy, [[0, -0.5], [0.4, 0], [0, 0.5], [-0.4, 0], [0, -0.5]])
  const linkInner = spts(cx, cy, [[0, -0.3], [0.25, 0], [0, 0.3], [-0.25, 0], [0, -0.3]])
  g.poly(linkOuter)
  g.fill(ST_DARK)
  g.poly(linkOuter)
  g.stroke({ width: TILE_SIZE * 0.05, color: outlineColor })
  g.poly(linkInner)
  g.fill(ST_GRAY)
  container.addChild(g)

  // Energy core: a diamond that scales with stored energy, animated each tick
  // via the shared fill-tween loop (see startLinkAnimation / updateLinkFill).
  const { energy: linkEnergy, capacity: linkCapacity } = getExtensionEnergy(obj)
  const linkFill = new Graphics()
  container.addChild(linkFill)
  const linkVisual = container as ContainerWithTarget
  linkVisual.__linkFillGraphics = linkFill
  linkVisual.__linkEnergy = linkEnergy
  linkVisual.__linkCapacity = linkCapacity
  updateLinkFill(linkVisual, calcLinkFillFraction(linkEnergy, linkCapacity))
}
