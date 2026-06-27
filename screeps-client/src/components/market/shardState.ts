import { serverVersion } from '~/stores/clientStore.js'
import { marketShard } from '~/stores/routeStore.js'

// Available shard names (empty on single-shard private servers, where the shard
// selector is hidden and requests omit the shard entirely).
export function marketShards(): string[] {
  return (serverVersion()?.serverData?.shards ?? []).filter((s): s is string => s != null)
}

// Shard the all-orders / resource views read from: the URL shard, else the first
// shard, else null (server default).
export function effectiveMarketShard(): string | null {
  return marketShard() ?? marketShards()[0] ?? null
}

// True when orders span multiple shards (drives the shard column / dropdown).
export function isMultiShard(): boolean {
  return marketShards().length > 1
}
