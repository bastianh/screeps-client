export interface RoomCoord {
  x: number
  y: number
}

export function parseRoomName(name: string): RoomCoord | null {
  const match = name.match(/^([WE])(\d+)([NS])(\d+)$/)
  if (!match) return null

  const [, ew, ewNum, ns, nsNum] = match
  const x = ew === 'W' ? -parseInt(ewNum, 10) : parseInt(ewNum, 10)
  const y = ns === 'N' ? -parseInt(nsNum, 10) : parseInt(nsNum, 10)

  return { x, y }
}

export function formatRoomName(x: number, y: number): string {
  const ew = x < 0 ? 'W' : 'E'
  const ns = y < 0 ? 'N' : 'S'
  return `${ew}${Math.abs(x)}${ns}${Math.abs(y)}`
}
