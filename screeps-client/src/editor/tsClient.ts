import * as Comlink from 'comlink'
import type { WorkerShape } from '@valtown/codemirror-ts/worker'
import type { ScreepsWorkerApi } from './tsWorker.js'

export type ModuleLang = 'js' | 'ts'

/** vfs path for a logical module, e.g. `main` (ts) → `/main.ts`. */
export const modulePath = (name: string, lang: ModuleLang) => `/${name}.${lang}`

// The worker exposes the valtown WorkerShape plus our transpile() extension.
export type ScreepsTsWorker = WorkerShape & Pick<Comlink.Remote<ScreepsWorkerApi>, 'transpile'>

let workerPromise: Promise<ScreepsTsWorker> | null = null

/**
 * Lazily spin up the TypeScript language-service worker. The heavy TS compiler
 * + lib chunk only loads the first time this is called (i.e. when a TS module is
 * opened), so pure-JS branches never pay for it. Cached for the session.
 */
export function getTsWorker(): Promise<ScreepsTsWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const raw = new Worker(new URL('./tsWorker.ts', import.meta.url), { type: 'module' })
      const worker = Comlink.wrap<ScreepsWorkerApi>(raw) as unknown as ScreepsTsWorker
      await worker.initialize()
      return worker
    })()
  }
  return workerPromise
}

/** Push a module's current source into the worker so cross-module imports resolve. */
export async function syncModuleToWorker(name: string, lang: ModuleLang, source: string) {
  const worker = await getTsWorker()
  await worker.updateFile({ path: modulePath(name, lang), code: source })
}
