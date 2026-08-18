/**
 * The per-object runtime for mod-defined types: owns one object's display tree and
 * re-applies its metadata whenever the object's state changes.
 *
 * Ported from `reference/renderer/engine/src/lib/GameObject.js`, minus the action
 * (tween) system — animated metadata renders in its resting state for now.
 */
import { Container, Text } from 'pixi.js'
import type { RendererCalculation, RendererObjectMetadata, RendererProcessor, RendererProps, RoomObject } from 'screeps-connectivity'
import { TILE_SIZE } from '../RoomRenderer.js'
import { parseExpression, resolveProp, type ExprParams } from './expressions.js'
import { PROCESSORS, type ProcessorParams } from './processors.js'
import { destroyTree } from '../destroyTree.js'
import { createLogger } from '~/utils/log.js'

const { warn } = createLogger('custom-renderer')

/**
 * Metadata is authored in the reference renderer's units, where one tile spans 100
 * units around the object's centre — that's why the stock examples draw an 80×80
 * rect and size sprites at 100. We scale that frame down to our TILE_SIZE.
 */
const METADATA_TILE_UNITS = 100

/** Structural equality over the JSON-shaped values object state carries. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

interface Runnable {
  props?: RendererProps
  when?: unknown
  shouldRun?: unknown
  until?: unknown
  once?: boolean
}

export class CustomObjectVisual {
  /** Attach this to the object's visual; it carries the metadata coordinate frame. */
  readonly root: Container
  private readonly scope: Record<string, Container> = {}
  private readonly processors: Array<RendererProcessor & { id: string; zIndex: number }>
  private readonly calculations: readonly RendererCalculation[]
  private readonly built = new Set<string>()
  private textNodes: Text[] = []
  private calcs: Record<string, unknown> = {}
  private prevCalcs: Record<string, unknown> = {}
  private prevState: RoomObject | null = null
  private worldScale = 1

  constructor(private readonly metadata: RendererObjectMetadata) {
    this.root = new Container()
    // Metadata positions everything relative to the tile centre; our object
    // containers sit at the tile's top-left corner.
    this.root.position.set(TILE_SIZE / 2, TILE_SIZE / 2)
    this.root.scale.set(TILE_SIZE / METADATA_TILE_UNITS)
    this.root.sortableChildren = true

    this.calculations = metadata.calculations ?? []
    // The reference assigns missing ids at random; deriving them from position
    // keeps them stable across rebuilds, which is what the scope keys want.
    this.processors = (metadata.processors ?? []).map((p, i) => ({
      ...p,
      id: p.id ?? `processor#${i}`,
      zIndex: p.zIndex ?? i,
    }))
  }

  /** Recompute calculations and re-run whichever processors the change affects. */
  applyState(state: RoomObject, roomState?: Record<string, unknown>): void {
    const firstRun = this.prevState === null
    const prevState = this.prevState
    this.prevCalcs = this.calcs
    const calcs: Record<string, unknown> = { ...this.calcs }

    const base: ExprParams = {
      state: state as unknown as Record<string, unknown>,
      prevState: (prevState ?? undefined) as Record<string, unknown> | undefined,
      stateExtra: roomState,
      calcs,
      prevCalcs: this.prevCalcs,
      firstRun,
    }

    if (firstRun && this.metadata.data) {
      for (const [key, value] of Object.entries(this.metadata.data)) {
        ;(this.root as unknown as Record<string, unknown>)[key] = parseExpression(value, base)
      }
    }

    for (const calculation of this.calculations) {
      const changed = this.propsChanged(calculation, state, prevState, calcs)
      if (!this.shouldRun(calculation, base, changed, prevState)) continue
      const { path = null, id = 'customField', func, payload } = calculation
      const params: ExprParams = {
        ...base,
        state: (path === null ? state : resolveProp(state, path)) as Record<string, unknown> | undefined,
        prevState: (path === null ? prevState : resolveProp(prevState, path)) as Record<string, unknown> | undefined,
        payload,
      }
      calcs[id] = parseExpression(func, params)
    }

    for (const processor of this.processors) {
      const changed = this.propsChanged(processor, state, prevState, calcs)
      const isFirstBuild = !this.built.has(processor.id)
      const shouldRun = this.shouldRun(processor, base, changed, prevState)
      const shouldDestruct = !shouldRun && this.shouldDestruct(processor, base, changed)

      // `once` builds on the first pass and then holds, however often props change.
      if (shouldRun && (!processor.once || isFirstBuild)) {
        this.runProcessor(processor, base, state, prevState)
      } else if (shouldDestruct) {
        this.destroyProcessor(processor.id)
      }
    }

    // Vanilla dims objects the server marks as provisional; mod types inherit it.
    if ((state as { temp?: unknown }).temp || (state as { tempRemove?: unknown }).tempRemove) {
      this.root.alpha = 0.3
    }

    this.calcs = calcs
    this.prevState = state
  }

  private runProcessor(
    processor: RendererProcessor & { id: string; zIndex: number },
    base: ExprParams,
    state: RoomObject,
    prevState: RoomObject | null,
  ): void {
    const run = PROCESSORS[processor.type]
    if (!run) {
      warn('unsupported processor type', processor.type)
      return
    }
    // A rebuild replaces the previous tree; drop its Text nodes so the scale pass
    // doesn't keep walking destroyed ones.
    this.pruneTextNodes()

    const { path = null } = processor
    const params: ProcessorParams = {
      ...base,
      state: (path === null ? state : resolveProp(state, path)) as Record<string, unknown> | undefined,
      prevState: (path === null ? prevState : resolveProp(prevState, path)) as Record<string, unknown> | undefined,
      rootContainer: this.root,
      scope: this.scope,
      payload: (processor.payload ?? {}) as Record<string, unknown>,
      processorId: processor.id,
      textNodes: this.textNodes,
      // `layer` names a world render layer in the reference (lighting, etc.). We
      // have no equivalent for arbitrary names, so layered output stays in place
      // and only its zIndex ordering is honoured.
      layer: processor.layer,
    }

    try {
      const result = run(params)
      if (result) {
        result.zIndex = processor.zIndex
        this.built.add(processor.id)
      }
    } catch (err) {
      warn('processor', processor.id, `(${processor.type})`, 'threw', err)
    }
    this.applyTextScale()
  }

  private destroyProcessor(id: string): void {
    const existing = this.scope[id]
    if (!existing) return
    destroyTree(existing)
    this.pruneTextNodes()
    delete this.scope[id]
    this.built.delete(id)
  }

  /** Processor teardown destroys the nodes; this drops the stale references. */
  private pruneTextNodes(): void {
    this.textNodes = this.textNodes.filter((t) => !t.destroyed)
  }

  private propsChanged(
    runnable: Runnable,
    state: RoomObject,
    prevState: RoomObject | null,
    calcs: Record<string, unknown>,
  ): boolean {
    if (!prevState) return true
    const { props = '*' } = runnable
    if (props === '*') return true
    return props.some((prop) =>
      !deepEqual((prevState as Record<string, unknown>)[prop], (state as unknown as Record<string, unknown>)[prop]) ||
      !deepEqual(this.prevCalcs[prop], calcs[prop]))
  }

  private shouldRun(runnable: Runnable, params: ExprParams, propsChanged: boolean, prevState: RoomObject | null): boolean {
    const when = runnable.when ?? runnable.shouldRun
    if (when !== undefined && !parseExpression(when, params)) return false
    if (!prevState) return true
    return propsChanged
  }

  private shouldDestruct(runnable: Runnable, params: ExprParams, propsChanged: boolean): boolean {
    if (!propsChanged) return false
    const when = runnable.when ?? runnable.shouldRun
    const { until } = runnable
    if (until !== undefined) return Boolean(parseExpression(until, params))
    return when !== undefined
  }

  /**
   * Counteract room zoom so metadata text keeps a constant on-screen size. The
   * reference does this per frame from a Pixi ticker; the layer already tracks
   * world scale for its own labels, so this rides along with that instead.
   */
  setWorldScale(scale: number): void {
    this.worldScale = scale || 1
    this.applyTextScale()
  }

  private applyTextScale(): void {
    // The metadata frame is already scaled down by TILE_SIZE/100; text has to
    // climb back out of that as well as out of the room zoom.
    const factor = METADATA_TILE_UNITS / TILE_SIZE / this.worldScale
    for (const node of this.textNodes) {
      if (!node.destroyed) node.scale.set(factor)
    }
  }

  destroy(): void {
    this.textNodes = []
    for (const id of Object.keys(this.scope)) delete this.scope[id]
    this.built.clear()
    destroyTree(this.root)
  }
}
