import type { WorldInfo } from 'screeps-connectivity'

export interface RoomCoord {
  x: number
  y: number
}

export function isRoomInWorld(x: number, y: number, bounds: WorldInfo): boolean {
  if (isNaN(bounds.minX) || isNaN(bounds.maxX) || isNaN(bounds.minY) || isNaN(bounds.maxY)) return true
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}

export function parseRoomName(name: string): RoomCoord | null {
  const match = name.match(/^([WE])(\d+)([NS])(\d+)$/)
  if (!match) return null

  const [, ew, ewNum, ns, nsNum] = match
  // W0 = -1, W1 = -2, ... / E0 = 0, E1 = 1, ...
  // N0 = -1, N1 = -2, ... / S0 = 0, S1 = 1, ...
  // This avoids -0 === 0 collision between W0/E0 and N0/S0.
  const x = ew === 'W' ? -(parseInt(ewNum, 10) + 1) : parseInt(ewNum, 10)
  const y = ns === 'N' ? -(parseInt(nsNum, 10) + 1) : parseInt(nsNum, 10)

  return { x, y }
}

export function formatRoomName(x: number, y: number): string {
  const ew = x < 0 ? 'W' : 'E'
  const ns = y < 0 ? 'N' : 'S'
  const ewNum = x < 0 ? (-x - 1) : x
  const nsNum = y < 0 ? (-y - 1) : y
  return `${ew}${ewNum}${ns}${nsNum}`
}

export function isBusCoord(coord: number): boolean {
  return coord === 0 || (coord < 0 && (coord + 1) % 10 === 0) || (coord > 0 && coord % 10 === 0)
}

export function isBusRoom(x: number, y: number): boolean {
  return isBusCoord(x) || isBusCoord(y)
}

export function isCenterRoom(x: number, y: number): boolean {
  const cx = x < 0 ? Math.abs(x + 1) % 10 : Math.abs(x) % 10
  const cy = y < 0 ? Math.abs(y + 1) % 10 : Math.abs(y) % 10
  return cx >= 4 && cx <= 6 && cy >= 4 && cy <= 6
}
