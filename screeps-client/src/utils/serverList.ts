export interface ServerConfig {
  id: string
  name: string
  url: string
  /** If set, only this auth type is offered when connecting to this server */
  forcedAuth?: 'password' | 'token' | 'guest'
  /** Whether to show the server password (connection password) field. Defaults to true. */
  hasServerPassword?: boolean
  /** Built-in servers cannot be removed or edited */
  builtin?: boolean
}

export const BUILTIN_SERVERS: readonly ServerConfig[] = [
  {
    id: 'screeps-world',
    name: 'Screeps World',
    url: 'https://screeps.com',
    forcedAuth: 'token',
    hasServerPassword: false,
    builtin: true,
  },
  {
    id: 'screeps-season',
    name: 'Screeps Season',
    url: 'https://season.screeps.com',
    forcedAuth: 'token',
    hasServerPassword: false,
    builtin: true,
  },
]

const LS_SERVERS = 'screeps:desktop:servers'
const LS_SELECTED = 'screeps:desktop:selectedServer'

export function getUserServers(): ServerConfig[] {
  try {
    const raw = localStorage.getItem(LS_SERVERS)
    return raw ? (JSON.parse(raw) as ServerConfig[]) : []
  } catch {
    return []
  }
}

function persistUserServers(servers: ServerConfig[]): void {
  localStorage.setItem(LS_SERVERS, JSON.stringify(servers))
}

export function getAllServers(): ServerConfig[] {
  return [...BUILTIN_SERVERS, ...getUserServers()]
}

export function addUserServer(server: Omit<ServerConfig, 'id' | 'builtin'>): ServerConfig {
  const existing = getUserServers()
  const newServer: ServerConfig = { ...server, id: crypto.randomUUID() }
  persistUserServers([...existing, newServer])
  return newServer
}

export function removeUserServer(id: string): void {
  persistUserServers(getUserServers().filter(s => s.id !== id))
}

export function updateUserServer(id: string, updates: Partial<Omit<ServerConfig, 'id' | 'builtin'>>): void {
  persistUserServers(getUserServers().map(s => s.id === id ? { ...s, ...updates } : s))
}

export function getLastSelectedServerId(): string | null {
  return localStorage.getItem(LS_SELECTED)
}

export function setLastSelectedServerId(id: string): void {
  localStorage.setItem(LS_SELECTED, id)
}
