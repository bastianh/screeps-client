/**
 * Runs a metadata `draw` processor's `payload.drawings` against a PixiJS v8 Graphics.
 *
 * Each entry names a Graphics method and its arguments, and the metadata in the
 * wild is written against PixiJS v4–v7 (`lineStyle`, `beginFill`, `drawRoundedRect`,
 * `endFill`). Pixi 8 still ships working deprecation shims for exactly those names
 * — `beginFill` sets `context.fillStyle`, `endFill` runs `context.fill()` and then
 * `context.stroke()` — so translation is Pixi's job, not ours, and its own shim is
 * the most faithful mapping available. Each deprecated name warns once per page
 * (Pixi dedupes on the message), so this doesn't flood the console.
 *
 * Two things are ours:
 *
 * 1. **The allowlist.** `drawings` is server-supplied JSON and the loop is a
 *    `graphics[name](...)` dispatch, so an unfiltered name lets a private server
 *    reach any method on the object — `destroy`, `clear` on a shared context, and
 *    so on. Only drawing methods are callable.
 * 2. **The terminating flush.** Old Pixi painted whatever was left pending at
 *    render time, so metadata that sets `lineStyle` and calls `moveTo`/`lineTo`
 *    without ever calling `endFill` still drew. Pixi 8 paints only on an explicit
 *    `fill()`/`stroke()`, so an unterminated path would silently vanish; we close
 *    it out with whatever styles were in effect.
 */
import type { Graphics } from 'pixi.js'
import { createLogger } from '~/utils/log.js'

const { warn } = createLogger('custom-renderer')

/** Methods that contribute geometry to the current path. */
const PATH_METHODS = new Set([
  'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'arcToSvg', 'closePath',
  'rect', 'roundRect', 'circle', 'ellipse', 'poly', 'star', 'regularPoly', 'roundPoly',
  'roundShape', 'filletRect', 'chamferRect',
  'drawRect', 'drawRoundedRect', 'drawCircle', 'drawEllipse', 'drawPolygon', 'drawStar',
])

/** Methods that paint the pending path, clearing it. */
const PAINT_METHODS = new Set(['fill', 'stroke', 'endFill'])

const FILL_STYLE_METHODS = new Set(['beginFill', 'setFillStyle'])
const STROKE_STYLE_METHODS = new Set(['lineStyle', 'setStrokeStyle'])

/** Everything else a drawing list may legitimately call. */
const MISC_METHODS = new Set(['clear', 'cut'])

const ALLOWED = new Set([
  ...PATH_METHODS, ...PAINT_METHODS, ...FILL_STYLE_METHODS, ...STROKE_STYLE_METHODS, ...MISC_METHODS,
])

export interface Drawing {
  method: string
  params: unknown[]
}

export function applyDrawings(g: Graphics, drawings: readonly Drawing[]): void {
  let pendingPath = false
  let hasFill = false
  let hasStroke = false

  for (const { method, params } of drawings) {
    if (!ALLOWED.has(method)) {
      warn('ignoring unsupported drawing method', method)
      continue
    }
    const fn = (g as unknown as Record<string, unknown>)[method]
    if (typeof fn !== 'function') {
      warn('drawing method missing on Graphics', method)
      continue
    }

    try {
      (fn as (...args: unknown[]) => unknown).apply(g, params)
    } catch (err) {
      warn('drawing method threw', method, err)
      continue
    }

    if (PATH_METHODS.has(method)) pendingPath = true
    else if (PAINT_METHODS.has(method)) pendingPath = false
    else if (FILL_STYLE_METHODS.has(method)) hasFill = true
    else if (STROKE_STYLE_METHODS.has(method)) hasStroke = true
    else if (method === 'clear') {
      pendingPath = false
      hasFill = false
      hasStroke = false
    }
  }

  // Close out geometry the metadata left unpainted (see the header note).
  if (pendingPath) {
    if (hasFill) g.fill()
    if (hasStroke) g.stroke()
  }
}
