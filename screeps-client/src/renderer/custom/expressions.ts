/**
 * The expression mini-language used by renderer metadata (`{ $state: 'counter' }`,
 * `{ $mul: [40, { $div: [...] }] }`). Ported from @screeps/renderer's
 * `lib/expressions` + `lib/utils/actionHelper`; see `reference/renderer/`.
 *
 * The reference implementation also ships a `compileExpression` variant that
 * pre-binds the operator tree into closures. That's a throughput optimisation for
 * a renderer driving every vanilla object through this path — we only run it for
 * mod-defined types, of which a room holds a handful, so the interpreted form is
 * kept for being the smaller thing to get right.
 */
import type { RendererExpression } from 'screeps-connectivity'

/** Everything an expression can read. Also the bag `$processorParam` resolves against. */
export interface ExprParams {
  /** The object's own state — a `RoomObject`, or a sub-path of one when the
   *  processor/calculation sets `path`. */
  state: Record<string, unknown> | undefined
  prevState?: Record<string, unknown>
  /** Whole-room state, for cross-object lookups. */
  stateExtra?: Record<string, unknown>
  calcs: Record<string, unknown>
  prevCalcs?: Record<string, unknown>
  /** The PixiJS object `$rel` reads from, when one is in scope. */
  target?: Record<string, unknown>
  firstRun: boolean
  tickDuration?: number
  [key: string]: unknown
}

/** Dotted/bracketed property lookup. `'^'` is the identity path (the object itself). */
export function resolveProp(obj: unknown, stringPath: string): unknown {
  if (!obj || stringPath === '^') return obj
  const path = stringPath.replace(/\[(\w+)]/g, '.$1').replace(/^\./, '')
  let cur: unknown = obj
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined
    // `in` needs an object; primitives along the path mean the lookup misses.
    if (typeof cur !== 'object' && typeof cur !== 'function') return undefined
    if (!(key in (cur as object))) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/** `$state`/`$calc`/`$rel`/`$processorParam` all share `default` + `koef` modifiers. */
type LookupOpts = { default?: unknown; koef?: number }

function lookup(source: unknown, name: unknown, rest: LookupOpts): unknown {
  const result = resolveProp(source, String(name))
  const value = result === undefined ? rest.default : result
  return typeof value === 'number' ? (rest.koef ?? 1) * value : value
}

const num = (v: unknown): number => Number(v)

/**
 * Operator table. Insertion order is load-bearing: `parseExpression` picks the
 * *first* operator whose `$key` the object carries, exactly as the reference does
 * by iterating its export order. Two operators in one object is malformed input
 * either way, but staying in step keeps behaviour identical for it.
 */
const EXPRESSIONS: Record<string, (arg: unknown, rest: never, params: ExprParams) => unknown> = {
  add: (args) => (args as unknown[]).reduce<number>((a, b) => a + num(b), 0),
  and: (args) => (args as unknown[]).every(Boolean),
  calc: (name, rest: LookupOpts, params) => lookup(params.calcs, name, rest),
  div: (args) => num((args as unknown[])[0]) / num((args as unknown[])[1]),
  // Loose equality, matching the reference's explicit `eqeqeq: off` — metadata
  // compares a numeric state field against a string literal and expects a match.
  eq: (args) => (args as unknown[])[0] == (args as unknown[])[1],
  gt: (args) => num((args as unknown[])[0]) > num((args as unknown[])[1]),
  gte: (args) => num((args as unknown[])[0]) >= num((args as unknown[])[1]),
  if: (condition, rest: { then?: unknown; else?: unknown }) =>
    condition ? (rest.then ?? true) : (rest.else ?? false),
  lt: (args) => num((args as unknown[])[0]) < num((args as unknown[])[1]),
  lte: (args) => num((args as unknown[])[0]) <= num((args as unknown[])[1]),
  max: (args) => Math.max(...(args as unknown[]).map(num)),
  min: (args) => Math.min(...(args as unknown[]).map(num)),
  mul: (args) => (args as unknown[]).reduce<number>((a, b) => a * num(b), 1),
  not: (arg) => !arg,
  or: (args) => (args as unknown[]).some(Boolean),
  processorParam: (name, rest: LookupOpts, params) => lookup(params, name, rest),
  random: (range) => Math.random() * num(range),
  rel: (name, rest: LookupOpts, params) => lookup(params.target, name, rest),
  state: (name, rest: LookupOpts, params) => lookup(params.state, name, rest),
  stateExtra: (name, rest: LookupOpts, params) => lookup(params.stateExtra, name, rest),
  sub: (args) => (args as unknown[]).slice(1).reduce<number>((a, b) => a - num(b), num((args as unknown[])[0])),
  idx: (args) => {
    const [target, key] = args as [unknown, unknown]
    if (target === null || target === undefined) return undefined
    return (target as Record<string, unknown>)[String(key)]
  },
  concat: (args) => (args as unknown[]).map((a) => String(a)).join(''),
}

const OPERATOR_KEYS = Object.keys(EXPRESSIONS)

/**
 * Evaluate one expression against `params`. Literals pass through, arrays map
 * element-wise, and plain objects have their values evaluated recursively — which
 * is how `payload: { alpha: { $state: 'x' } }` works without the payload itself
 * being an operator.
 *
 * Note both branches of `$if` are evaluated before the condition selects one; the
 * language has no short-circuit and the reference behaves the same way.
 */
export function parseExpression(expression: RendererExpression, params: ExprParams): unknown {
  if (expression === null || expression === undefined) return expression
  if (Array.isArray(expression)) return parseExpressions(expression, params)
  if (typeof expression !== 'object') return expression

  const obj = expression as Record<string, unknown>
  const operator = OPERATOR_KEYS.find((key) => `$${key}` in obj)
  if (operator) {
    const { [`$${operator}`]: operand, ...rest } = obj
    return EXPRESSIONS[operator](
      parseExpression(operand, params),
      parseExpression(rest, params) as never,
      params,
    )
  }
  return parseObjectValues(obj, params)
}

export function parseExpressions(expressions: readonly RendererExpression[], params: ExprParams): unknown[] {
  return expressions.map((e) => parseExpression(e, params))
}

function parseObjectValues(object: Record<string, unknown>, params: ExprParams): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(object)) {
    result[key] = parseExpression(value, params)
  }
  return result
}
