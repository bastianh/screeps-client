// Maps between the server's flat module map and the editor's logical modules.
//
// The Screeps server stores a branch as `Record<moduleName, source>` where every
// key is a runnable module (no file extension — `main`, `utils`) that the runtime
// may `require`. It has no notion of TypeScript.
//
// To let people edit TypeScript we use a naming convention purely as a storage
// marker: a logical TS module `main` is persisted as *two* server keys —
//   `main`      → the compiled JS the runtime actually runs
//   `main.ts`   → the original TS source, never `require`d, so it's inert
// A runnable key with a matching `<name>.ts` sibling is therefore the compiled
// artifact of a TS module and is hidden from the UI; a runnable key with no
// sibling is hand-written JS.
//
// Caveat: a hand-written JS module literally named `foo.ts` would be mistaken for
// TS source. That collision is accepted — `.ts` is a deliberate convention here.
//
// Besides source strings the server also stores binary (WebAssembly) modules as
// `{ binary: <base64> }` values. Those surface as `wasm` logical modules whose
// `source` holds the base64 payload — never editable text.

export type ModuleLang = 'js' | 'ts' | 'wasm'

/** Server-side module value: source text, or a base64-carried binary module. */
export type ServerModule = string | { binary: string }

export interface LogicalModule {
  /** Logical name as shown in the UI and required at runtime, e.g. `main`. */
  name: string
  lang: ModuleLang
  /** What the editor edits: JS source for `js`, TS source for `ts`. For `wasm`
   *  the base64 payload of the binary — displayed, never edited. */
  source: string
}

const TS_SUFFIX = '.ts'

const isTsKey = (key: string) => key.endsWith(TS_SUFFIX)
const tsBase = (key: string) => key.slice(0, -TS_SUFFIX.length)

/** Filename shown in the tab / module list, e.g. `main.ts` or `utils.js`. */
export const displayName = (mod: LogicalModule) => `${mod.name}.${mod.lang}`

/**
 * Turn a server module map into the logical modules the editor works with.
 * Compiled artifacts of TS modules are folded into their `.ts` source and not
 * surfaced separately. Encounter order of runnable keys is preserved (so `main`
 * stays first if it is first on the server), with any TS-source-only modules
 * that lack a compiled sibling appended after.
 */
export function parseServerModules(server: Record<string, ServerModule>): LogicalModule[] {
  const tsSources = new Map<string, string>()
  for (const [key, value] of Object.entries(server)) {
    if (typeof value === 'string' && isTsKey(key)) tsSources.set(tsBase(key), value)
  }

  const modules: LogicalModule[] = []
  const seen = new Set<string>()
  // Runnable keys first, in their existing order.
  for (const [key, value] of Object.entries(server)) {
    if (typeof value !== 'string') {
      // Binary (WebAssembly) module — the value shape decides, not the key.
      seen.add(key)
      modules.push({ name: key, lang: 'wasm', source: value.binary })
      continue
    }
    if (isTsKey(key)) continue
    seen.add(key)
    if (tsSources.has(key)) {
      modules.push({ name: key, lang: 'ts', source: tsSources.get(key)! })
    } else {
      modules.push({ name: key, lang: 'js', source: value })
    }
  }
  // TS sources whose compiled sibling doesn't exist yet (e.g. never saved).
  for (const [base, source] of tsSources) {
    if (!seen.has(base)) modules.push({ name: base, lang: 'ts', source })
  }
  return modules
}

/**
 * Build the server module map to persist. JS modules map straight to their key.
 * A TS module writes both its compiled JS (looked up in `compiled` by logical
 * name) under the plain key and its source under `<name>.ts`. Since the server
 * replaces the whole branch on save, deletes fall out by omission.
 *
 * Throws if a TS module has no entry in `compiled` — callers transpile first.
 */
export function serializeModules(
  modules: LogicalModule[],
  compiled: Record<string, string>,
): Record<string, ServerModule> {
  const out: Record<string, ServerModule> = {}
  for (const mod of modules) {
    if (mod.lang === 'ts') {
      if (!(mod.name in compiled)) {
        throw new Error(`missing compiled output for TS module "${mod.name}"`)
      }
      out[mod.name] = compiled[mod.name]
      out[mod.name + TS_SUFFIX] = mod.source
    } else if (mod.lang === 'wasm') {
      out[mod.name] = { binary: mod.source }
    } else {
      out[mod.name] = mod.source
    }
  }
  return out
}

/** Logical names of the TS modules that need transpiling before a save. */
export const tsModuleNames = (modules: LogicalModule[]) =>
  modules.filter((m) => m.lang === 'ts').map((m) => m.name)
