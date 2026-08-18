/**
 * Types for the declarative renderer metadata that private-server mods publish
 * through `/api/version` → `serverData.renderer` and `serverData.customObjectTypes`.
 *
 * A mod builds these server-side with
 * `config.backend.renderer.metadata['myobject'] = { processors: [...] }` — see
 * https://github.com/screeps/launcher/tree/master/init_dist/example-mods/custom-objects.
 * The format is @screeps/renderer's; its semantics are documented at
 * https://github.com/screeps/renderer.
 *
 * Everything here is deliberately loose. The DSL is open-ended (a processor's
 * `payload` is whatever its processor type accepts) and the server round-trips
 * mod-authored JSON verbatim, so unknown keys must survive rather than be
 * type-errors. Consumers are expected to validate what they actually read.
 */

/**
 * A node of the expression mini-language. Either a literal, an array of
 * expressions, or an object carrying exactly one `$`-prefixed operator key
 * (`{ $state: 'counter' }`, `{ $mul: [40, { $div: [...] }] }`).
 */
export type RendererExpression = unknown

/** `'*'` (the default) re-runs on any state change; an array re-runs only when one
 *  of the named state or calculation properties changed. */
export type RendererProps = readonly string[] | '*'

/** A named value derived from object state, reusable across processors as
 *  `{ $calc: '<id>' }` and recomputed only when `props` change. */
export interface RendererCalculation {
  id?: string
  props?: RendererProps
  /** Sub-path of the object state the `func` sees as its `state`; defaults to the whole object. */
  path?: string
  func?: RendererExpression
  payload?: unknown
  when?: RendererExpression
  once?: boolean
}

/** One display-tree step: creates or updates a PixiJS object from `payload`. */
export interface RendererProcessor {
  /** Scope key, used as `parentId` by other processors. Auto-assigned when omitted. */
  id?: string
  /** Processor name — `draw`, `sprite`, `text`, `circle`, `container`, … */
  type: string
  props?: RendererProps
  path?: string
  /** Named render layer (`lighting`, …). Clients without that layer render in place. */
  layer?: string
  zIndex?: number
  /** Build once on first state and never rebuild, however often `props` change. */
  once?: boolean
  when?: RendererExpression
  shouldRun?: RendererExpression
  until?: RendererExpression
  payload?: Record<string, RendererExpression>
  actions?: readonly unknown[]
}

/** The render description for one object `type`, as served under `renderer.metadata`. */
export interface RendererObjectMetadata {
  calculations?: readonly RendererCalculation[]
  processors?: readonly RendererProcessor[]
  actions?: readonly unknown[]
  /** Processor run when the object disappears, to play it out before teardown. */
  disappearProcessor?: RendererProcessor
  /** Default texture name for `sprite` processors that don't name their own. */
  texture?: string
  /** Properties assigned to the object's root container on first state. */
  data?: Record<string, RendererExpression>
  zIndex?: number
  [key: string]: unknown
}

/**
 * `serverData.renderer`. `resources` maps a texture name to a URL, where the
 * literal `{ASSETS_URL}` stands for the client's asset base.
 */
export interface ServerRendererConfig {
  metadata?: Record<string, RendererObjectMetadata>
  resources?: Record<string, string>
}

/**
 * `serverData.customObjectTypes[type]`. `sidepanel` is an Angular-1 template
 * string (`{{object.counter}}`) written against the reference client — treat it
 * as untrusted markup, not as something to hand to a template engine.
 */
export interface ServerCustomObjectType {
  sidepanel?: string
  [key: string]: unknown
}
