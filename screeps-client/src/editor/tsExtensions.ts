import { autocompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import {
  tsFacetWorker,
  tsSyncWorker,
  tsAutocompleteWorker,
  tsLinterWorker,
  tsHoverWorker,
} from '@valtown/codemirror-ts'
import type { ScreepsTsWorker } from './tsClient.js'

// Kept separate from tsClient.ts so that getting a handle on the worker does not
// drag the CodeMirror extension packages into the importer's chunk — the console
// input talks to the same worker but renders its own completion list.

/** CodeMirror extensions that wire the editor to the worker for the given TS file path. */
export function tsExtensions(worker: ScreepsTsWorker, path: string): Extension {
  return [
    tsFacetWorker.of({ worker, path }),
    tsSyncWorker(),
    autocompletion({ override: [tsAutocompleteWorker()] }),
    tsLinterWorker(),
    tsHoverWorker(),
  ]
}
