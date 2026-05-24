export { ScreepsClient } from './ScreepsClient.js'
export type { ScreepsClientOptions } from './ScreepsClient.js'

export { Logger } from './logger.js'
export type { LogFn } from './logger.js'

export { TokenAuth } from './http/auth/TokenAuth.js'
export { PasswordAuth } from './http/auth/PasswordAuth.js'
export { GuestAuth } from './http/auth/GuestAuth.js'
export { SteamTicketAuth } from './http/auth/SteamTicketAuth.js'
export type { AuthStrategy } from './http/auth/AuthStrategy.js'

export { IndexedDBStorage } from './storage/IndexedDBStorage.js'
export { NullStorage } from './storage/NullStorage.js'
export type { StorageAdapter } from './storage/StorageAdapter.js'

export { SubscriptionGroup } from './subscription/index.js'
export type { Subscription } from './subscription/index.js'

export { TerrainType, RoomTerrain } from './types/game.js'
export type {
  RoomObject,
  RoomObjectMap,
  RoomObjectDiff,
  RoomMap2Data,
  UserInfo,
  CpuStats,
  WorldStatus,
  ConsoleMessage,
  ServerVersion,
  ServerFeature,
  ScreepsmodAuthFeature,
  ShardInfo,
  WorldInfo,
  Badge,
  VisualStyle,
  RoomVisualEntry,
} from './types/game.js'

export { fetchServerVersion, fetchAuthModInfo, checkUsername, checkEmail, registerUser, getServerFeature, getScreepsmodAuth } from './http/fetchServerVersion.js'
export type { ApiAuthModInfoResponse } from './http/fetchServerVersion.js'

export { badgeToSvg } from './badge/index.js'
export { BadgeColors } from './badge/colors.js'
export type { ColorEntry } from './badge/colors.js'
export type { RoomStoreEvents, UserStoreEvents, ServerStoreEvents, MapStoreEvents, Map2SubscriptionStatus, HttpClientEvents } from './types/events.js'

export type { UserMessagesEndpoints } from './http/endpoints/user-messages.js'
export type { PowerCreepsEndpoints } from './http/endpoints/power-creeps.js'
export type { RegisterEndpoints } from './http/endpoints/register.js'
export type { HttpClient, RateLimitInfo } from './http/HttpClient.js'
export type { SocketClient } from './socket/SocketClient.js'
export type { RoomStore } from './stores/RoomStore.js'
export type { UserStore } from './stores/UserStore.js'
export type { ServerStore } from './stores/ServerStore.js'
export type { MapStore, Map2Subscription, MapStoreOptions } from './stores/MapStore.js'
export type { NavigationStore, NavigationState, NavigationStoreEvents } from './stores/NavigationStore.js'
