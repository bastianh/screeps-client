// Centralized storage keys and helpers.
// localStorage = persistent UI/settings; sessionStorage = auth tokens (cleared on browser close).

export const LS = {
  room: 'screeps:room',
  shard: 'screeps:shard',
  sidebarWidth: 'screeps:sidebarWidth',
  consoleHeight: 'screeps:consoleHeight',
  consoleSplit: 'screeps:consoleSplit',
  mapZoom: 'screeps:mapZoom',
  widescreenMode: 'screeps:settings:widescreenMode',
  showCreepLabels: 'screeps:settings:showCreepLabels',
  showMapRoomNames: 'screeps:settings:showMapRoomNames',
  showUnclaimableRooms: 'screeps:settings:showUnclaimableRooms',
} as const

export const SS = {
  url: 'screeps:url',
  token: 'screeps:token',
  serverPassword: 'screeps:serverPassword',
} as const

export function getStr(key: string): string | null {
  return localStorage.getItem(key)
}

export function setStr(key: string, value: string): void {
  localStorage.setItem(key, value)
}

export function removeLocal(key: string): void {
  localStorage.removeItem(key)
}

export function getNum(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n !== 0 ? n : fallback
}

export function setNum(key: string, value: number): void {
  localStorage.setItem(key, String(value))
}

export function getSession(key: string): string | null {
  return sessionStorage.getItem(key)
}

export function setSession(key: string, value: string): void {
  sessionStorage.setItem(key, value)
}

export function removeSession(key: string): void {
  sessionStorage.removeItem(key)
}
