import { basePath } from './embedded.js'

// URL builders/parsers for the game views (/map and /room). The shard, when the
// server reports one, is carried as a path segment rather than a query param:
//   /map                 /map/shard0
//   /room/W11N11         /room/shard0/W11N11
// A missing shard segment means "the server's default / only shard" (private
// servers that report no shards on start).

export function buildMapUrl(shard: string | null): string {
  return shard ? `${basePath()}/map/${encodeURIComponent(shard)}` : `${basePath()}/map`
}

export function buildRoomUrl(room: string, shard: string | null): string {
  return shard
    ? `${basePath()}/room/${encodeURIComponent(shard)}/${room}`
    : `${basePath()}/room/${room}`
}
