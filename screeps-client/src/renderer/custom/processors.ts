/**
 * The processor subset of the renderer metadata DSL: the ones that build PixiJS
 * display objects (`object`, `container`, `draw`, `sprite`, `text`, `circle`).
 *
 * The reference renderer's remaining processors — `creepBuildBody`, `road`,
 * `terrain`, `say`, `powerInfluence`, `siteProgress`, `userBadge`, … — describe
 * vanilla objects, which this client draws with its own per-type modules under
 * `renderer/objects/`. Mod-defined types only ever reach for the generic ones.
 *
 * Ported from `reference/renderer/engine/src/lib/processors/`.
 */
import { BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js'
import { parseExpression, type ExprParams } from './expressions.js'
import { applyDrawings, type Drawing } from './graphicsCompat.js'
import { loadCustomTexture, peekCustomTexture } from './resources.js'
import { destroyTree } from '../destroyTree.js'
import { createLogger } from '~/utils/log.js'

const { warn } = createLogger('custom-renderer')

export interface ProcessorParams extends ExprParams {
  /** The object's own container; processors without a `parentId` attach here. */
  rootContainer: Container
  /** Processor id → its display object, so `parentId` and cross-processor
   *  `targetId` lookups resolve. */
  scope: Record<string, Container>
  /** Raw (unevaluated) processor payload. */
  payload: Record<string, unknown>
  /** Processor id, the default scope key for whatever it creates. */
  processorId: string
  /** Text nodes created this run — collected so the layer can keep them at a
   *  constant on-screen size as the room zooms. */
  textNodes: Text[]
}

/**
 * Properties a payload may set directly on the created display object. The
 * reference does a blanket `Object.assign`, which on Pixi 8 is a good way to
 * clobber an accessor (`parent`, `children`, `filters`) with server-supplied JSON,
 * so the set is explicit. `scale`, `pivot`, `anchor`, `width` and `height` are
 * handled separately below and deliberately absent here.
 */
const ASSIGNABLE = new Set(['x', 'y', 'alpha', 'tint', 'rotation', 'angle', 'visible', 'zIndex', 'roundPixels'])

/** PixiJS ≤7 numeric blend modes, as metadata still spells them. */
const LEGACY_BLEND_MODES: Record<number, string> = {
  0: 'normal', 1: 'add', 2: 'multiply', 3: 'screen', 4: 'overlay',
  5: 'darken', 6: 'lighten', 7: 'color-dodge', 8: 'color-burn', 9: 'hard-light',
  10: 'soft-light', 11: 'difference', 12: 'exclusion', 13: 'hue', 14: 'saturation',
  15: 'color', 16: 'luminosity',
}

function applyBlendMode(object: Container, value: unknown): void {
  const mode = typeof value === 'number' ? LEGACY_BLEND_MODES[value] : value
  if (typeof mode !== 'string') {
    warn('unusable blendMode', value)
    return
  }
  ;(object as { blendMode: string }).blendMode = mode
}

/**
 * The shared body of every display-object processor — scope bookkeeping,
 * `shouldCreate` gating, parenting, sizing, and payload application.
 *
 * `factory` defers construction because Pixi 8 constructor signatures diverge
 * (`Text` takes an options object where the reference passed positional args), so
 * the DSL's `constructorParams` cannot be splatted uniformly.
 */
function createDisplayObject<T extends Container>(
  params: ProcessorParams,
  factory: () => T,
): T | null {
  const { rootContainer, scope, payload, processorId } = params
  const {
    id = processorId,
    parentId,
    addToParent = true,
    width,
    height,
    scale: payloadScale,
    shouldCreate = true,
    pivot: payloadPivot,
    anchor: payloadAnchor,
    blur,
    blendMode,
    ...objectOptions
  } = payload as Record<string, unknown>

  const scopeKey = String(id)

  // Re-running a processor replaces whatever it built last time. This is the hot
  // path — a props-driven processor rebuilds on every tick that touches its state
  // — so it goes through destroyTree, which frees each Graphics' own context
  // rather than leaving it for the renderer's 60-second GC.
  const previous = scope[scopeKey]
  if (previous) {
    destroyTree(previous)
    delete scope[scopeKey]
  }

  if (!parseExpression(shouldCreate, params)) return null

  const parent = parentId ? scope[String(parentId)] : rootContainer
  if (!parent) {
    warn('processor', processorId, 'has no parent with id', parentId)
    return null
  }

  const object = factory()

  // `width`/`height` are target sizes, converted to a scale against the object's
  // natural size; naming only one scales proportionally. A zero natural size (an
  // empty Graphics, a texture that hasn't decoded) would divide to Infinity.
  const scale = { x: 1, y: 1, ...(payloadScale as object | undefined) }
  const parsedWidth = width === undefined ? undefined : Number(parseExpression(width, params))
  const parsedHeight = height === undefined ? undefined : Number(parseExpression(height, params))
  if (parsedWidth !== undefined && object.width > 0) {
    scale.x = parsedWidth / object.width
    if (parsedHeight === undefined) scale.y = scale.x
  }
  if (parsedHeight !== undefined && object.height > 0) {
    scale.y = parsedHeight / object.height
    if (parsedWidth === undefined) scale.x = scale.y
  }

  // Metadata centres by default: an explicit pivot wins, otherwise anchor 0.5.
  const pivot = { ...(payloadPivot as Record<string, unknown> | undefined) }
  const anchor = { ...(payloadAnchor as Record<string, unknown> | undefined) }
  if (pivot.x !== undefined) pivot.x = Number(parseExpression(pivot.x, params)) / scale.x
  else if (anchor.x === undefined) anchor.x = 0.5
  if (pivot.y !== undefined) pivot.y = Number(parseExpression(pivot.y, params)) / scale.y
  else if (anchor.y === undefined) anchor.y = 0.5

  for (const [key, value] of Object.entries(objectOptions)) {
    if (!ASSIGNABLE.has(key)) {
      warn('ignoring unsupported payload property', key, 'on processor', processorId)
      continue
    }
    ;(object as unknown as Record<string, unknown>)[key] = parseExpression(value, params)
  }
  if (blendMode !== undefined) applyBlendMode(object, parseExpression(blendMode, params))

  const parsedScale = parseExpression(scale, params) as { x: number; y: number }
  if (Number.isFinite(parsedScale.x) && Number.isFinite(parsedScale.y)) {
    object.scale.set(parsedScale.x, parsedScale.y)
  }
  // Only Sprite and Text carry an anchor; on a Container it silently does nothing.
  const anchored = object as unknown as { anchor?: { set: (x: number, y: number) => void } }
  if (anchored.anchor && (anchor.x !== undefined || anchor.y !== undefined)) {
    const parsed = parseExpression(anchor, params) as { x?: number; y?: number }
    anchored.anchor.set(Number(parsed.x ?? 0), Number(parsed.y ?? 0))
  }
  if (pivot.x !== undefined || pivot.y !== undefined) {
    const parsed = parseExpression(pivot, params) as { x?: number; y?: number }
    object.pivot.set(Number(parsed.x ?? 0), Number(parsed.y ?? 0))
  }

  if (blur !== undefined) {
    object.filters = [new BlurFilter({ strength: Number(parseExpression(blur, params)) })]
  }

  if (addToParent) parent.addChild(object)
  scope[scopeKey] = object
  return object
}

function containerProcessor(params: ProcessorParams): Container | null {
  return createDisplayObject(params, () => new Container())
}

function drawProcessor(params: ProcessorParams): Container | null {
  const { drawings = [], ...rest } = params.payload
  const graphics = createDisplayObject({ ...params, payload: rest }, () => new Graphics())
  if (!graphics) return null
  if (!Array.isArray(drawings)) {
    warn('payload.drawings is not an array on processor', params.processorId)
    return graphics
  }
  const parsed: Drawing[] = drawings
    .filter((d): d is { method: string; params?: unknown[] } =>
      typeof d === 'object' && d !== null && typeof (d as { method?: unknown }).method === 'string')
    .map((d) => ({
      method: d.method,
      params: (parseExpression(d.params ?? [], params) as unknown[]) ?? [],
    }))
  applyDrawings(graphics, parsed)
  return graphics
}

function circleProcessor(params: ProcessorParams): Container | null {
  const { color, radius = 25, stroke = 0x000000, strokeWidth, ...rest } = params.payload
  const drawings: Drawing[] = []
  if (strokeWidth) {
    drawings.push({
      method: 'lineStyle',
      params: [Number(parseExpression(strokeWidth, params)), parseExpression(stroke, params), 1],
    })
  }
  const hasFill = color !== undefined && color !== null
  if (hasFill) drawings.push({ method: 'beginFill', params: [parseExpression(color, params)] })
  drawings.push({ method: 'drawCircle', params: [0, 0, Number(parseExpression(radius, params))] })
  if (hasFill) drawings.push({ method: 'endFill', params: [] })

  return drawProcessor({ ...params, payload: { ...rest, drawings } })
}

function spriteProcessor(params: ProcessorParams): Container | null {
  const { texture, parentId, ...rest } = params.payload
  const name = parseExpression(texture, params)
  if (typeof name !== 'string' || name === '') {
    warn('sprite processor', params.processorId, 'has no texture name')
    return null
  }

  const ready = peekCustomTexture(name)
  if (ready) {
    return createDisplayObject({ ...params, payload: { ...rest, parentId } }, () => new Sprite(ready))
  }

  // Not decoded yet: claim the slot with an empty container now and fill it in
  // when the texture lands, so a slow asset doesn't stall the rest of the object.
  const placeholder = containerProcessor({ ...params, payload: { parentId } })
  if (!placeholder) return null
  void loadCustomTexture(name).then((loaded) => {
    if (!loaded || placeholder.destroyed) return
    const sprite = createDisplayObject(
      // A private scope keeps the late arrival from evicting whatever now owns
      // this processor's id — by the time it resolves, a rebuild may have run.
      { ...params, scope: {}, payload: { ...rest, addToParent: false }, rootContainer: placeholder },
      () => new Sprite(loaded),
    )
    if (sprite) placeholder.addChild(sprite)
  })
  return placeholder
}

function textProcessor(params: ProcessorParams): Container | null {
  const { text = '?', style, ...rest } = params.payload
  const content = String(parseExpression(text, params) ?? '')
  const parsedStyle = (parseExpression(style, params) as Record<string, unknown> | undefined) ?? {}

  const node = createDisplayObject(
    { ...params, payload: rest },
    () => new Text({ text: content, style: { fill: '#ffffff', fontSize: 12, ...parsedStyle } }),
  )
  if (node) params.textNodes.push(node as Text)
  return node
}

export type Processor = (params: ProcessorParams) => Container | null

export const PROCESSORS: Record<string, Processor> = {
  circle: circleProcessor,
  container: containerProcessor,
  draw: drawProcessor,
  object: containerProcessor,
  sprite: spriteProcessor,
  text: textProcessor,
}
