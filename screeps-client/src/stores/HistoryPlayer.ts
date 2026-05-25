import type { RoomObjectMap, RoomObjectDiff, RoomObject } from 'screeps-connectivity'

interface RoomHistoryChunk {
  timestamp: number
  room: string
  base: number
  ticks: Record<string, RoomObjectDiff>
}

export class HistoryPlayer {
  private readonly chunkCache = new Map<number, RoomHistoryChunk>()

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

  private async loadChunk(base: number): Promise<RoomHistoryChunk> {
    const cached = this.chunkCache.get(base)
    if (cached) return cached

    const url = this.buildUrl(base)
    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['X-Token'] = token
      headers['X-Username'] = token
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const chunk = await res.json() as RoomHistoryChunk
    this.chunkCache.set(base, chunk)
    return chunk
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

  async getStateAtTick(tick: number): Promise<{ objects: RoomObjectMap; diff: RoomObjectDiff; gameTime: number }> {
    const base = this.chunkBase(tick)
    const chunk = await this.loadChunk(base)

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

    return { objects, diff: chunk.ticks[String(tick)] ?? {}, gameTime: tick }
  }
}
