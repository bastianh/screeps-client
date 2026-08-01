import { createSignal } from 'solid-js'
import { LS, SS, getJson, setJson, getSession } from '~/utils/storage.js'

const [showLog, setShowLog] = createSignal(true)
const [showConsole, setShowConsole] = createSignal(true)
const [showMemory, setShowMemory] = createSignal(false)
// Segments is not a console pane — it opens the full-canvas SegmentsPanel
// overlay (like the code editor), but its button lives in the console bar.
const [showSegments, setShowSegments] = createSignal(false)
// The Custom UI editor is a full-canvas overlay (like the segments panel) but is
// opened from Settings → Custom UI rather than the console bar.
const [showCustomUiEditor, setShowCustomUiEditor] = createSignal(false)
const [consoleInput, setConsoleInput] = createSignal('')

let consoleInputEl: HTMLInputElement | undefined

export function registerConsoleInput(el: HTMLInputElement): void {
  consoleInputEl = el
}

export function insertConsole(text: string): void {
  setConsoleInput(text)
  resetHistoryCursor()
  setShowConsole(true)
  requestAnimationFrame(() => {
    consoleInputEl?.focus()
    const len = text.length
    consoleInputEl?.setSelectionRange(len, len)
  })
}

export { showLog, showConsole, showMemory, showSegments, showCustomUiEditor, setShowLog, setShowConsole, setShowMemory, setShowSegments, setShowCustomUiEditor, consoleInput, setConsoleInput }

// --- Command history -------------------------------------------------------
// Persisted per server: `Game.creeps.Harvester1` from a private server is
// meaningless on MMO, so the active server URL is appended to the key (same
// convention as the Custom UI per-server keys).

const HISTORY_LIMIT = 200

const [history, setHistory] = createSignal<string[]>([])
// Ephemeral navigation state: where ArrowUp/Down currently sit in the history,
// and the half-typed command stashed when navigation started.
const [historyIdx, setHistoryIdx] = createSignal<number | null>(null)
const [historyDraft, setHistoryDraft] = createSignal('')

let loadedKey: string | null = null

function historyKey(): string {
  return `${LS.consoleHistory}:${getSession(SS.url) ?? ''}`
}

/**
 * Load the persisted history for the active server. Called on mount rather than
 * at module load because the server URL is only known after login.
 */
export function loadConsoleHistory(): void {
  const key = historyKey()
  if (loadedKey === key) return
  loadedKey = key
  const raw = getJson<unknown>(key, [])
  const entries = Array.isArray(raw) ? raw.filter((e): e is string => typeof e === 'string') : []
  setHistory(entries.slice(-HISTORY_LIMIT))
  setHistoryIdx(null)
  setHistoryDraft('')
}

/**
 * Append a command. Recorded even when the request failed — a rejected command
 * is exactly the one you want to recall and fix.
 */
export function pushConsoleHistory(cmd: string): void {
  const trimmed = cmd.trim()
  if (!trimmed) return
  setHistory((prev) => {
    // Consecutive duplicates would make ArrowUp useless.
    if (prev[prev.length - 1] === trimmed) return prev
    const next = [...prev, trimmed]
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
  })
  setJson(historyKey(), history())
  resetHistoryCursor()
}

/** Move one entry back. Returns the command to show, or null to stay put. */
export function historyPrev(current: string): string | null {
  const h = history()
  if (h.length === 0) return null
  const idx = historyIdx()
  if (idx === null) {
    setHistoryDraft(current)
    setHistoryIdx(h.length - 1)
    return h[h.length - 1]
  }
  if (idx === 0) return null
  setHistoryIdx(idx - 1)
  return h[idx - 1]
}

/** Move one entry forward; past the newest entry the stashed draft returns. */
export function historyNext(): string | null {
  const h = history()
  const idx = historyIdx()
  if (idx === null) return null
  if (idx < h.length - 1) {
    setHistoryIdx(idx + 1)
    return h[idx + 1]
  }
  setHistoryIdx(null)
  return historyDraft()
}

/** Drop the navigation cursor — call whenever the user edits the input. */
export function resetHistoryCursor(): void {
  setHistoryIdx(null)
  setHistoryDraft('')
}

export function toggleShowLog(): void {
  setShowLog((prev) => !prev)
}

export function toggleShowConsole(): void {
  setShowConsole((prev) => !prev)
}

export function toggleShowMemory(): void {
  setShowMemory((prev) => !prev)
}

export function toggleShowSegments(): void {
  setShowSegments((prev) => !prev)
}
