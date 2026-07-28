import type { ApiRoomDecorationActive, ApiRoomDecorationDef } from 'screeps-connectivity'
import { propEntries } from './activation.js'

// Geometry behind the position editor, kept free of DOM so it can be tested directly.

/** Placement of a decoration, in room cells. `rotation` is radians. */
export interface Placement {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface SizeBounds {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
}

export interface EditorCapabilities {
  positionable: boolean
  resizable: boolean
  rotatable: boolean
  proportional: boolean
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** A decoration may only be moved, resized or turned where the schema allows it. */
export function editorCapabilities(decoration: ApiRoomDecorationDef): EditorCapabilities {
  const props = new Map(propEntries(decoration))
  const editable = (name: string) => props.has(name) && props.get(name)?.readonly !== true

  return {
    positionable: editable('x') && editable('y'),
    resizable: editable('width') && editable('height'),
    rotatable: editable('rotation'),
    proportional: decoration.props?.proportional === true,
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && !isNaN(value) ? value : fallback
}

/** Read the placement out of an activation state. Numbers may arrive as strings. */
export function placementOf(active: ApiRoomDecorationActive): Placement {
  return {
    x: Number(active.x ?? 0),
    y: Number(active.y ?? 0),
    width: Number(active.width ?? 1),
    height: Number(active.height ?? 1),
    rotation: Number(active.rotation ?? 0),
  }
}

/** Size limits in cells. The reference falls back to 1…25 when the schema is silent. */
export function sizeBounds(decoration: ApiRoomDecorationDef): SizeBounds {
  const props = decoration.props
  return {
    minWidth: numberOr(props?.minWidth, 1),
    maxWidth: numberOr(props?.maxWidth, 25),
    minHeight: numberOr(props?.minHeight, 1),
    maxHeight: numberOr(props?.maxHeight, 25),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Keep a placement inside the room.
 *
 * A decoration may hang off the top or left edge — the reference only requires that at
 * least one cell of it stays inside (`x + width ≥ 1`), and that its origin doesn't run
 * past the far edge (`x ≤ 49`).
 */
export function clampPlacement(placement: Placement, bounds: SizeBounds): Placement {
  const width = clamp(placement.width, bounds.minWidth, bounds.maxWidth)
  const height = clamp(placement.height, bounds.minHeight, bounds.maxHeight)
  return {
    ...placement,
    width,
    height,
    x: clamp(placement.x, 1 - width, 49),
    y: clamp(placement.y, 1 - height, 49),
  }
}

/**
 * Resize from one handle by a pointer delta in cells.
 *
 * Dragging a left or top handle moves the origin so the opposite edge stays put. Under
 * `proportional` the aspect ratio is preserved: a corner takes the smaller of the two
 * scale factors (as the reference does), while an edge handle is driven by its own axis
 * alone — taking the minimum there would pin the size and make the handle inert.
 */
export function applyResize(
  start: Placement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  bounds: SizeBounds,
  proportional: boolean,
): Placement {
  const left = handle.includes('w')
  const right = handle.includes('e')
  const top = handle.includes('n')
  const bottom = handle.includes('s')

  let width = start.width + (right ? dx : left ? -dx : 0)
  let height = start.height + (bottom ? dy : top ? -dy : 0)

  if (proportional) {
    const horizontal = left || right
    const vertical = top || bottom
    const wRatio = width / start.width
    const hRatio = height / start.height

    let ratio: number
    if (horizontal && vertical) ratio = Math.min(wRatio, hRatio)
    else if (horizontal) ratio = wRatio
    else ratio = hRatio

    // Clamp the ratio rather than the sides, or the aspect would break at the limits.
    const maxRatio = Math.min(bounds.maxWidth / start.width, bounds.maxHeight / start.height)
    const minRatio = Math.max(bounds.minWidth / start.width, bounds.minHeight / start.height)
    ratio = clamp(ratio, minRatio, maxRatio)

    width = start.width * ratio
    height = start.height * ratio
  } else {
    width = clamp(width, bounds.minWidth, bounds.maxWidth)
    height = clamp(height, bounds.minHeight, bounds.maxHeight)
  }

  return {
    ...start,
    width,
    height,
    x: left ? start.x + start.width - width : start.x,
    y: top ? start.y + start.height - height : start.y,
  }
}

/** Angle from a frame's centre to a point, in radians — what the rotate handle reports. */
export function angleTo(centreX: number, centreY: number, pointX: number, pointY: number): number {
  return Math.atan2(pointY - centreY, pointX - centreX)
}

/** Wrap an angle into (-π, π] so the stored value stays in the range the API uses. */
export function normalizeAngle(angle: number): number {
  const wrapped = ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  // -π and π are the same heading; the reference stores π.
  return wrapped === -Math.PI ? Math.PI : wrapped
}

export const DEG = 180 / Math.PI
