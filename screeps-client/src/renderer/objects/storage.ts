import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { ST_DARK, ST_GRAY } from '../colors.js'
import { drawStoreBands, getStoreBands } from './store.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Storage visuals: rounded barrel shell with stacked resource bands.
// ── Storage helpers ────────────────────────────────────────────────────────
// Geometry follows the official client's storage art: a rounded "barrel" shell
// (dark fill, owner-tinted outline) over a grey inner box, bands on top. Upstream
// draws it at 200px on a 100px tile, so it overhangs by half a tile in each
// direction (1.54 × 1.94 tiles). We keep that silhouette but scale it down to just
// over a tile — the one knob for the structure's overall size.
export const STORAGE_SCALE = 0.65

// The shell and inner box come from storage-border.svg / storage.svg, authored in a
// 177.15 viewBox rendered at 200px — one SVG unit is 0.0112897 tiles before scaling.
export const STORAGE_SVG_U = TILE_SIZE * 0.0112897 * STORAGE_SCALE

// Upstream's metadata sizes the fill bars in tile pixels rather than SVG units.
export const STORAGE_PX_U = TILE_SIZE * 0.01 * STORAGE_SCALE

// Shell arc endpoints span a 120×140 box around the tile centre; the caps (r=120)
// bulge outward top/bottom, the sides (r=300) bulge left/right.
export const STORAGE_SHELL_HW = 60 * STORAGE_SVG_U
export const STORAGE_SHELL_HH = 70 * STORAGE_SVG_U
export const STORAGE_SHELL_CAP_R = 120 * STORAGE_SVG_U
export const STORAGE_SHELL_SIDE_R = 300 * STORAGE_SVG_U
export const STORAGE_SHELL_STROKE = 7 * STORAGE_SVG_U

// Grey inner box: 100×120, centred on the tile.
export const STORAGE_INNER_W = 100 * STORAGE_SVG_U
export const STORAGE_INNER_H = 120 * STORAGE_SVG_U

// Fill-band rect in container coords (cx = cy = TILE_SIZE/2). Upstream's bars are
// 110 wide, 140 tall at a full store, with the floor 70 below the centre. At a full
// store they therefore overhang the grey box slightly top and bottom — the shell's
// outline absorbs it, as upstream.
export const STORAGE_BOX_W = 110 * STORAGE_PX_U
export const STORAGE_BOX_H = 140 * STORAGE_PX_U
export const STORAGE_BOX_X = TILE_SIZE * 0.5 - STORAGE_BOX_W / 2
export const STORAGE_BOX_Y = TILE_SIZE * 0.5 + 70 * STORAGE_PX_U - STORAGE_BOX_H

// Transcribed from storage-border.svg's single path: start top-left, cap across the
// top, down the right side, cap back across the bottom, up the left side. Issued once
// per fill and once per stroke, since either consumes the current path.
export function storageShellPath(g: Graphics, cx: number, cy: number): void {
  const left = cx - STORAGE_SHELL_HW, right = cx + STORAGE_SHELL_HW
  const top = cy - STORAGE_SHELL_HH, bottom = cy + STORAGE_SHELL_HH
  const cap = STORAGE_SHELL_CAP_R, side = STORAGE_SHELL_SIDE_R
  g.moveTo(left, top)
  g.arcToSvg(cap, cap, 0, 0, 1, right, top)
  g.arcToSvg(side, side, 0, 0, 1, right, bottom)
  g.arcToSvg(cap, cap, 0, 0, 1, left, bottom)
  g.arcToSvg(side, side, 0, 0, 1, left, top)
  g.closePath()
}

export function calcStorageFillHeight(used: number, capacity: number): number {
  if (capacity <= 0 || used <= 0) return 0
  return STORAGE_BOX_H * Math.min(1, used / capacity)
}

export function updateStorageFill(visual: ContainerWithTarget, height: number): void {
  const fill = visual.__storageFillG
  if (!fill) return
  fill.clear()
  drawStoreBands(fill, STORAGE_BOX_X, STORAGE_BOX_Y + STORAGE_BOX_H, STORAGE_BOX_W, height, visual.__storageBands, visual.__storageUsed ?? 0)
}
export function createStorageVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy, outlineColor } = ctx
  const { bands: storageBands, used: storageUsed, capacity: storageCap } = getStoreBands(obj)
  storageShellPath(g, cx, cy)
  g.fill(ST_DARK)
  storageShellPath(g, cx, cy)
  g.stroke({ width: STORAGE_SHELL_STROKE, color: outlineColor })
  g.rect(cx - STORAGE_INNER_W / 2, cy - STORAGE_INNER_H / 2, STORAGE_INNER_W, STORAGE_INNER_H)
  g.fill(ST_GRAY)
  container.addChild(g)

  const storageFillG = new Graphics()
  container.addChild(storageFillG)
  ;(container as ContainerWithTarget).__storageFillG = storageFillG
  ;(container as ContainerWithTarget).__storageBands = storageBands
  ;(container as ContainerWithTarget).__storageUsed = storageUsed
  ;(container as ContainerWithTarget).__storageCapacity = storageCap
  updateStorageFill(container as ContainerWithTarget, calcStorageFillHeight(storageUsed, storageCap))
}
