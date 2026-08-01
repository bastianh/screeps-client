import { getTsWorker } from './tsClient.js'

// Autocompletion for the console command line, backed by the same in-browser
// TypeScript service the code editor uses — so `Game`, `Memory`, the room-object
// API and every game constant come from @types/screeps for free.
//
// No CodeMirror involved: the worker's getAutocompletion() takes a plain
// `{ pos, explicit }` and returns plain data, so the panel can render its own
// list against a normal <input>.

const CONSOLE_PATH = '/console.ts'

// Enough to scroll through, few enough to stay cheap to render. TypeScript
// happily returns several hundred entries for a bare global scope.
const MAX_OPTIONS = 50

export interface ConsoleCompletion {
  label: string
  /** TS element kind ('method', 'property', 'keyword', …) — used for the icon. */
  type?: string
}

export interface ConsoleCompletionResult {
  /** Offset in the source where the replaced word starts. */
  from: number
  options: ConsoleCompletion[]
}

interface RawOption {
  label: string
  type?: string
  boost: number
}

/**
 * Rank and trim what the language service returned. The service hands back
 * everything visible at that position; filtering by what the user actually typed
 * is normally CodeMirror's job, so we do it here.
 */
function rank(options: RawOption[], prefix: string): ConsoleCompletion[] {
  const needle = prefix.toLowerCase()
  const scored: { opt: RawOption; score: number }[] = []
  for (const opt of options) {
    if (!needle) {
      scored.push({ opt, score: 0 })
      continue
    }
    const label = opt.label.toLowerCase()
    // Prefix matches rank above mid-word matches; anything else is dropped.
    if (label.startsWith(needle)) scored.push({ opt, score: 0 })
    else if (label.includes(needle)) scored.push({ opt, score: 1 })
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    if (a.opt.boost !== b.opt.boost) return b.opt.boost - a.opt.boost
    return a.opt.label.localeCompare(b.opt.label)
  })
  return scored.slice(0, MAX_OPTIONS).map(({ opt }) => ({ label: opt.label, type: opt.type }))
}

/**
 * Ask the TypeScript service what fits at `pos` in `source`.
 *
 * `source` is pushed as a bare top-level statement — it must stay free of
 * import/export, otherwise the file becomes a module and the Screeps globals
 * fall out of scope. Not a concern for one-liners.
 *
 * Loads the TS worker on first call, so only ever call this once the user has
 * actually asked for completions.
 */
export async function completeConsole(
  source: string,
  pos: number,
  explicit: boolean,
): Promise<ConsoleCompletionResult | null> {
  const worker = await getTsWorker()
  await worker.updateFile({ path: CONSOLE_PATH, code: source })
  const result = await worker.getAutocompletion({ path: CONSOLE_PATH, context: { pos, explicit } })
  if (!result) return null
  const raw = result.options.map((o) => ({
    label: typeof o.label === 'string' ? o.label : String(o.label),
    type: o.type,
    boost: o.boost ?? 0,
  }))
  const options = rank(raw, source.slice(result.from, pos))
  if (options.length === 0) return null
  return { from: result.from, options }
}
