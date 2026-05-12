import type { RoomObjectMap, RoomTerrain, CpuStats, ConsoleMessage } from './game.js'

export interface RoomStoreEvents {
  'room:update': { room: string; shard: string; gameTime: number; objects: RoomObjectMap }
  'room:terrainavailable': { room: string; shard: string; terrain: RoomTerrain }
}

export interface UserStoreEvents {
  'user:cpu': CpuStats
  'user:console': { messages: ConsoleMessage }
  'user:code': { branch: string; modules: Record<string, string> }
}

export interface ServerStoreEvents {
  'server:connected': Record<string, never>
  'server:disconnected': { willReconnect: boolean }
  'server:error': { error: Error }
}
