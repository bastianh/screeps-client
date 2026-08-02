import { basePath } from './embedded.js'

// URL builders/parsers for the game views (/map and /room). The shard, when the
// server reports one, is carried as a path segment rather than a query param:
//   /map                 /map/shard0
//   /room/W11N11         /room/shard0/W11N11
// A missing shard segment means "the server's default / only shard" (private
// servers that report no shards on start).

// Where the world map is looking, in room units — `x`/`y` are world room
// coordinates (W0N0 is -1,-1; see parseRoomName) with a fractional part, so
// `.5` is a room's centre. Same shape as the official client's `?pos=x,y`.
export interface MapView {
  pos: { x: number; y: number } | null
  zoom: number | null
}

// Two decimals is finer than a single screen pixel at any zoom and keeps the
// address bar readable.
function round(v: number): number {
  return Math.round(v * 100) / 100
}

// /map/<shard>?zoom=<z>&pos=<x>,<y> — the shard identifies the world, while the
// camera lives in the query: it changes constantly while panning and is written
// with replaceState, so it should never look like a distinct page.
export function buildMapUrl(shard: string | null, view?: MapView): string {
  const path = shard ? `${basePath()}/map/${encodeURIComponent(shard)}` : `${basePath()}/map`
  // Assembled by hand rather than with URLSearchParams, which would escape the
  // separating comma to %2C — legal, but unreadable in the address bar.
  const params: string[] = []
  if (view?.zoom) params.push(`zoom=${round(view.zoom)}`)
  if (view?.pos) params.push(`pos=${round(view.pos.x)},${round(view.pos.y)}`)
  return params.length > 0 ? `${path}?${params.join('&')}` : path
}

// Camera state from a /map URL's query. Anything missing or malformed comes back
// as null, leaving the caller on its own default (start room, saved zoom).
export function parseMapView(search: string): MapView {
  const params = new URLSearchParams(search)
  const raw = params.get('pos')
  const parts = raw ? raw.split(',').map(Number) : []
  const pos = parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
    ? { x: parts[0], y: parts[1] }
    : null
  const zoom = Number(params.get('zoom'))
  return { pos, zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : null }
}

export function buildRoomUrl(room: string, shard: string | null): string {
  return shard
    ? `${basePath()}/room/${encodeURIComponent(shard)}/${room}`
    : `${basePath()}/room/${room}`
}

// The read-only per-room stats page (owner + stat tiles + history graph), a
// top-level route distinct from the live /room game view. Same shard-as-segment
// convention as buildRoomUrl:
//   /room-overview/E8S49            (single-shard servers)
//   /room-overview/shard1/E8S49
export function buildRoomOverviewUrl(room: string, shard: string | null): string {
  return shard
    ? `${basePath()}/room-overview/${encodeURIComponent(shard)}/${room}`
    : `${basePath()}/room-overview/${room}`
}
