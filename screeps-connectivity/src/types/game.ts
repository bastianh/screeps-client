export enum TerrainType {
  Plain = 0,
  Wall = 1,
  Swamp = 2,
}

export class RoomTerrain {
  readonly raw: Uint8Array

  constructor(data: Uint8Array) {
    this.raw = data
  }

  get(x: number, y: number): TerrainType {
    return this.raw[y * 50 + x] as TerrainType
  }

  static fromEncodedString(encoded: string): RoomTerrain {
    const data = new Uint8Array(2500)
    for (let i = 0; i < 2500; i++) {
      const v = parseInt(encoded[i], 10)
      data[i] = v === 3 ? TerrainType.Wall : (v as TerrainType)
    }
    return new RoomTerrain(data)
  }
}

export interface Badge {
  type: number | { path1: string; path2: string }
  color1: string
  color2: string
  color3: string
  param: number
  flip: boolean
}

export interface RoomObject {
  _id: string
  type: string
  room: string
  x: number
  y: number
  [key: string]: unknown
}

export type RoomObjectMap = Record<string, RoomObject>

export interface UserInfo {
  _id: string
  username: string
  email: string
  cpu: number
  gcl: number
  credits: number
  badge: Badge
}

export interface CpuStats {
  cpu: number
  memory: number
}

export interface ConsoleMessage {
  log: string[]
  results: string[]
}

export interface ServerVersion {
  ok: number
  package: number
  protocol: number
  users: number
  serverData: {
    historyChunkSize: number
    features: Array<{ name: string }>
    shards: string[]
  }
}

export interface ShardInfo {
  name: string
  lastTicks: number[]
  cpuLimit: number
  rooms: number
  users: number
  tick: number
}
