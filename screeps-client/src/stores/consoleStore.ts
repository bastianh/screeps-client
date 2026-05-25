import { createSignal } from 'solid-js'

const [showLog, setShowLog] = createSignal(true)
const [showConsole, setShowConsole] = createSignal(true)
const [showMemory, setShowMemory] = createSignal(false)

export { showLog, showConsole, showMemory, setShowLog, setShowConsole, setShowMemory }

export function toggleShowLog(): void {
  setShowLog((prev) => !prev)
}

export function toggleShowConsole(): void {
  setShowConsole((prev) => !prev)
}

export function toggleShowMemory(): void {
  setShowMemory((prev) => !prev)
}
