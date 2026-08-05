import type {
    Badge,
    ConsoleMessage,
    CpuStats,
    RoomMap2Data,
    RoomObjectDiff,
    RoomObjectMap,
    RoomTerrain,
    ServerVersion,
    ShardInfo,
    UserInfo,
    WorldStatus
} from './game.js'
import type {MapStatsRoomData} from '../stores/MapStatsStore.js'
import type {ApiCodeModule, ApiRoomDecorationItem} from './api.js'

export interface RoomStoreEvents {
    'room:update': {
        room: string;
        shard: string | null;
        gameTime: number | undefined;
        objects: RoomObjectMap;
        diff: RoomObjectDiff;
        visual: string;
        users?: Record<string, { _id: string; username: string; badge?: Badge }>
    }
    'room:terrainavailable': { room: string; shard: string | null; terrain: RoomTerrain }
    'room:error': { room: string; shard: string | null; message: string }
    /**
     * Decorations carried by a room tick message. These are incremental — the server
     * sends whatever it considers current, so consumers merge them into the list they
     * fetched from `/api/game/room-decorations`.
     */
    'room:decorations': { room: string; shard: string | null; decorations: ApiRoomDecorationItem[] }
}

export type Map2SubscriptionStatus = 'pending' | 'active'

export interface MapStoreEvents {
    'room:map2update': { room: string; shard: string | null; data: RoomMap2Data; source: 'cache' | 'live' }
    'room:map2state': { room: string; shard: string | null; status: Map2SubscriptionStatus }
}

export interface UserStoreEvents {
    'user:me': UserInfo
    'user:worldStatus': { status: WorldStatus }
    'user:cpu': CpuStats
    'user:console': { messages: ConsoleMessage }
    'user:code': { branch: string; modules: Record<string, ApiCodeModule> }
    'user:setActiveBranch': { activeName: 'activeWorld' | 'activeSim'; branch: string }
    'user:stream': Record<string, unknown>
    'user:memory': { path: string; shard: string | null; value: unknown }
    'user:mapVisual': { shard: string | null; data: string }
}

export interface ServerStoreEvents {
    'server:connected': Record<string, never>
    'server:disconnected': { willReconnect: boolean; intentional: boolean }
    'server:error': { error: Error }
    'server:version': ServerVersion
    'server:shards': ShardInfo[]
}

export interface MapStatsStoreEvents {
    'mapStats:room': { room: string; shard: string | null; stat: MapStatsRoomData }
}

export interface HttpClientEvents {
    'http:success': {
        method: string
        path: string
        status: number
    }
    'http:error': {
        method: string
        path: string
        status: number
        error: Error
        // Set when the request opted out of user-facing error surfacing (e.g. an
        // optional endpoint whose failure the caller handles gracefully).
        silent?: boolean
    }
    'http:tokenRefresh': {
        token: string
    }
}
