import type { RoomObjectMap, RoomObjectDiff, RoomObject, RoomHistoryChunk } from 'screeps-connectivity'

interface GameHttpClient {
  game: {
    roomHistory(room: string, time: number, shard?: string | null): Promise<RoomHistoryChunk>
  }
}

/**
 * Thrown when the requested tick has no history data on the server (the chunk
 * returns 404 / doesn't exist). Callers should treat this as "pick another tick"
 * rather than a hard error to surface as a failure toast.
 */
export class HistoryUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HistoryUnavailableError'
  }
}

function isNotFound(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 404) return true
  const message = (err as { message?: string } | null)?.message
  return typeof message === 'string' && message.includes('HTTP 404')
}

export class HistoryPlayer {
  private readonly chunkCache = new Map<number, RoomHistoryChunk>()
  private readonly inflight = new Map<number, Promise<RoomHistoryChunk>>()

  constructor(
    private readonly room: string,
    private readonly shard: string | null,
    private readonly http: GameHttpClient,
    private readonly chunkSize: number,
  ) {}

  chunkBase(tick: number): number {
    return tick - (tick % this.chunkSize)
  }

  private loadChunk(base: number): Promise<RoomHistoryChunk> {
    const cached = this.chunkCache.get(base)
    if (cached) return Promise.resolve(cached)

    const existing = this.inflight.get(base)
    if (existing) return existing

    const promise = this.http.game.roomHistory(this.room, base, this.shard)
      .then((chunk) => {
        this.chunkCache.set(base, chunk)
        this.inflight.delete(base)
        return chunk
      })
      .catch((err: Error) => {
        this.inflight.delete(base)
        throw err
      })

    this.inflight.set(base, promise)
    return promise
  }

  private applyDiff(base: RoomObjectMap, diff: RoomObjectDiff): RoomObjectMap {
    const result = { ...base }
    for (const id in diff) {
      const val = diff[id]
      if (val === null) {
        delete result[id]
      } else if (result[id]) {
        result[id] = { ...result[id], ...val } as RoomObject
      } else {
        result[id] = val as RoomObject
      }
    }
    return result
  }

  async getStateAtTick(tick: number): Promise<{ objects: RoomObjectMap; diff: RoomObjectDiff; gameTime: number; clampedTo?: number }> {
    let base = this.chunkBase(tick)
    let chunk: RoomHistoryChunk
    let clampedTo: number | undefined

    try {
      chunk = await this.loadChunk(base)
    } catch (primaryErr) {
      // Chunk not yet written — fall back to the previous one
      const prevBase = base - this.chunkSize
      if (prevBase < 0) {
        if (isNotFound(primaryErr)) throw new HistoryUnavailableError(`No history data available for tick ${tick}`)
        throw primaryErr
      }
      try {
        chunk = await this.loadChunk(prevBase)
      } catch (prevErr) {
        // Neither the requested chunk nor the previous one exists — genuinely no data.
        if (isNotFound(prevErr)) throw new HistoryUnavailableError(`No history data available for tick ${tick}`)
        throw prevErr
      }
      base = prevBase
      // Clamp tick to the highest available tick in the previous chunk
      const available = Object.keys(chunk.ticks).map(Number).filter(t => t >= base)
      const clamped = available.length > 0 ? Math.max(...available) : base
      clampedTo = clamped
      tick = clamped
    }

    // The base tick entry is the full room state (all objects present, no nulls)
    const baseDiff = chunk.ticks[String(base)] ?? {}
    let objects: RoomObjectMap = {}
    for (const id in baseDiff) {
      if (baseDiff[id] !== null) objects[id] = baseDiff[id] as RoomObject
    }

    // Apply diffs forward from base+1 to the requested tick
    for (let t = base + 1; t <= tick; t++) {
      const d = chunk.ticks[String(t)]
      if (d && Object.keys(d).length > 0) {
        objects = this.applyDiff(objects, d)
      }
    }

    return { objects, diff: chunk.ticks[String(tick)] ?? {}, gameTime: tick, clampedTo }
  }
}
