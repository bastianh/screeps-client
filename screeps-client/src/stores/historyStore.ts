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

export function enterHistoryMode(currentTick: number): void {
  const max = currentTick
  const min = Math.max(0, max - 200000)
  setHistoryMaxTick(max)
  setHistoryMinTick(min)
  setHistoryTick(currentTick)
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

export function setPlaybackSpeedValue(speed: number): void {
  setPlaybackSpeed(speed)
  if (isPlaying()) {
    _startTimer()
  }
}
