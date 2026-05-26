import { createSignal } from 'solid-js'

const [showLog, setShowLog] = createSignal(true)
const [showConsole, setShowConsole] = createSignal(true)
const [showMemory, setShowMemory] = createSignal(false)
const [consoleInput, setConsoleInput] = createSignal('')

let consoleInputEl: HTMLInputElement | undefined

export function registerConsoleInput(el: HTMLInputElement): void {
  consoleInputEl = el
}

export function insertConsole(text: string): void {
  setConsoleInput(text)
  setShowConsole(true)
  requestAnimationFrame(() => {
    consoleInputEl?.focus()
    const len = text.length
    consoleInputEl?.setSelectionRange(len, len)
  })
}

export { showLog, showConsole, showMemory, setShowLog, setShowConsole, setShowMemory, consoleInput, setConsoleInput }

export function toggleShowLog(): void {
  setShowLog((prev) => !prev)
}

export function toggleShowConsole(): void {
  setShowConsole((prev) => !prev)
}

export function toggleShowMemory(): void {
  setShowMemory((prev) => !prev)
}
