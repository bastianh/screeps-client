import type { RoomObjectMap, RoomObjectDiff, RoomObject } from 'screeps-connectivity'

interface RoomHistoryChunk {
  timestamp: number
  room: string
  base: number
  ticks: Record<string, RoomObjectDiff>
}

export class HistoryPlayer {
  private readonly chunkCache = new Map<number, RoomHistoryChunk>()
  private readonly inflight = new Map<number, Promise<RoomHistoryChunk>>()

  constructor(
    private readonly room: string,
    private readonly shard: string | null,
    private readonly baseUrl: string,  // from c.http.baseUrl — ends with '/'
    private readonly getToken: () => string | null,
    private readonly chunkSize: number,
    private readonly isPrivate: boolean,
  ) {}

  chunkBase(tick: number): number {
    return tick - (tick % this.chunkSize)
  }

  private buildUrl(base: number): string {
    if (this.isPrivate || this.shard === null) {
      // Private server: GET /room-history?room=W1N1&time=1000
      return `${this.baseUrl}room-history?room=${encodeURIComponent(this.room)}&time=${base}`
    }
    // Official server: GET /room-history/shard0/W1N1/1000.json
    return `${this.baseUrl}room-history/${encodeURIComponent(this.shard)}/${encodeURIComponent(this.room)}/${base}.json`
  }

  private loadChunk(base: number): Promise<RoomHistoryChunk> {
    const cached = this.chunkCache.get(base)
    if (cached) return Promise.resolve(cached)

    const existing = this.inflight.get(base)
    if (existing) return existing

    const url = this.buildUrl(base)
    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['X-Token'] = token
      headers['X-Username'] = token
    }

    const promise = fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<RoomHistoryChunk>
      })
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
    } catch {
      // Chunk not yet written — fall back to the previous one
      const prevBase = base - this.chunkSize
      if (prevBase < 0) throw new Error(`No history data available before tick ${base}`)
      chunk = await this.loadChunk(prevBase)
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
