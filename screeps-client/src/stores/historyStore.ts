import { createSignal } from 'solid-js'

export const [historyMode, setHistoryMode] = createSignal(false)
export const [historyTick, setHistoryTick] = createSignal(0)
export const [historyMinTick, setHistoryMinTick] = createSignal(0)
export const [historyMaxTick, setHistoryMaxTick] = createSignal(0)
export const [isPlaying, setIsPlaying] = createSignal(false)
export const [playbackSpeed, setPlaybackSpeed] = createSignal(1)
export const [historyLoading, setHistoryLoading] = createSignal(false)

let _timer: ReturnType<typeof setInterval> | null = null

function _stopTimer(): void {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
}

function _startTimer(): void {
  _stopTimer()
  _timer = setInterval(() => {
    const next = historyTick() + 1
    if (next > historyMaxTick()) {
      _stopTimer()
      setIsPlaying(false)
    } else {
      setHistoryTick(next)
    }
  }, Math.max(50, Math.round(1000 / playbackSpeed())))
}

// Fallback replay window (in ticks) when the server doesn't report a retention
// window via serverData.historyKeepTicks.
const DEFAULT_HISTORY_WINDOW = 200000

// keepTicks: retention window in ticks from serverData.historyKeepTicks.
//   undefined/null → server didn't report it, use the default window.
//   0              → history is kept forever (unbounded), allow seeking back to tick 0.
//   > 0            → earliest replayable tick is currentTick - keepTicks.
// chunkSize: history is written in fixed-size chunks. The chunk containing the
//   current tick isn't flushed yet, so we open at the start of the previous,
//   fully-written chunk (e.g. chunkSize 100, tick 540 → 400) instead of at the
//   current tick, which would 404 and require a fallback round-trip.
export function enterHistoryMode(currentTick: number, keepTicks?: number | null, chunkSize?: number): void {
  const max = currentTick
  const window = keepTicks == null ? DEFAULT_HISTORY_WINDOW : keepTicks === 0 ? max : keepTicks
  const min = Math.max(0, max - window)
  const size = chunkSize && chunkSize > 0 ? chunkSize : 0
  const startTick = size > 0
    ? Math.max(min, currentTick - (currentTick % size) - size)
    : currentTick
  setHistoryMaxTick(max)
  setHistoryMinTick(min)
  setHistoryTick(Math.max(min, startTick))
  setIsPlaying(false)
  _stopTimer()
  setHistoryMode(true)
}

export function exitHistoryMode(): void {
  _stopTimer()
  setIsPlaying(false)
  setHistoryMode(false)
}

export function seekToTick(tick: number): void {
  const clamped = Math.max(historyMinTick(), Math.min(historyMaxTick(), tick))
  setHistoryTick(clamped)
}

export function stepTick(delta: number): void {
  seekToTick(historyTick() + delta)
}

export function togglePlayback(): void {
  if (isPlaying()) {
    _stopTimer()
    setIsPlaying(false)
  } else {
    setIsPlaying(true)
    _startTimer()
  }
}

export function pausePlayback(): void {
  _stopTimer()
  setIsPlaying(false)
}

export function setPlaybackSpeedValue(speed: number): void {
  setPlaybackSpeed(speed)
  if (isPlaying()) {
    _startTimer()
  }
}
