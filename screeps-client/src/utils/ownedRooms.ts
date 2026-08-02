import type { ApiUserRoomsResponse } from 'screeps-connectivity'

export interface OwnedRoom {
  room: string
  shard: string | null
}

// The rooms endpoint shape varies by server: multishard keys rooms by shard,
// single-shard may return a flat list. Normalize both to {room, shard}. Shared
// by the Overview (self) and Profile (public) owned-room minimap grids.
export function extractOwnedRooms(res: ApiUserRoomsResponse): OwnedRoom[] {
  if (res.shards) {
    return Object.entries(res.shards).flatMap(([shard, list]) =>
      (list ?? []).map((room) => ({ room, shard })))
  }
  return (res.rooms ?? []).map((room) => ({ room, shard: null }))
}

// Group owned rooms by shard for the minimap grids. Multishard servers key
// rooms by shard; single-shard servers report shard: null, which collapses to
// one unlabeled group. Sort shards by name so the order is stable.
export function groupRoomsByShard(rooms: OwnedRoom[]): [string | null, OwnedRoom[]][] {
  const groups = new Map<string | null, OwnedRoom[]>()
  for (const r of rooms) {
    const arr = groups.get(r.shard)
    if (arr) arr.push(r)
    else groups.set(r.shard, [r])
  }
  return [...groups.entries()].sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
}
