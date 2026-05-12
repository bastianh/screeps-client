import type { ScreepsClient, RoomTerrain, RoomObjectMap } from 'screeps-connectivity'

export interface ClientState {
  client: ScreepsClient | null
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error: string | null
}

export interface RoomViewState {
  room: string
  shard: string
  terrain: RoomTerrain | null
  objects: RoomObjectMap | null
  gameTime: number | null
}
