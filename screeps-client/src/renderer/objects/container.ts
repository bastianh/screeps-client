import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY } from '../colors.js'
import { drawStoreBands, getStoreBands } from './store.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Container visuals: framed box with stacked resource bands.
export const CONT_W = TILE_SIZE * 0.45
export const CONT_H = TILE_SIZE * 0.6
export const CONT_X = TILE_SIZE * 0.275  // cx - TILE_SIZE * 0.225
export const CONT_Y = TILE_SIZE * 0.2    // cy - TILE_SIZE * 0.3
export const CONT_MARGIN = Math.max(0.5, TILE_SIZE * 0.02)  // frames the grey interior and insets the fill bands

export function calcContainerFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return CONT_H * Math.min(1, used / capacity)
}

export function updateContainerFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__containerFillG
  if (!fill) return
  fill.clear()
  drawStoreBands(fill, CONT_X, CONT_Y + CONT_H, CONT_W, height, visual.__containerBands, visual.__containerUsed ?? 0, CONT_MARGIN)
}
export function createContainerVisual(ctx: VisualBuildContext): void {
  const { obj, container, g } = ctx
  const { bands: contBands, used: contUsed, capacity: contCap } = getStoreBands(obj)
  g.rect(CONT_X, CONT_Y, CONT_W, CONT_H)
  g.fill(ST_DARK)
  // Grey interior backdrop (like storage) — shows above the fill; the dark box frames it.
  g.rect(CONT_X + CONT_MARGIN, CONT_Y + CONT_MARGIN, CONT_W - CONT_MARGIN * 2, CONT_H - CONT_MARGIN * 2)
  g.fill(ST_GRAY)
  container.addChild(g)

  const contFillG = new Graphics()
  container.addChild(contFillG)
  ;(container as ContainerWithTarget).__containerFillG = contFillG
  ;(container as ContainerWithTarget).__containerBands = contBands
  ;(container as ContainerWithTarget).__containerUsed = contUsed
  ;(container as ContainerWithTarget).__containerCapacity = contCap
  updateContainerFill(container as ContainerWithTarget, calcContainerFillHeight(contUsed, contCap))

  const contBorderG = new Graphics()
  contBorderG.rect(CONT_X, CONT_Y, CONT_W, CONT_H)
  contBorderG.stroke({ width: TILE_SIZE * 0.1, color: ST_DARK })
  container.addChild(contBorderG)
}
