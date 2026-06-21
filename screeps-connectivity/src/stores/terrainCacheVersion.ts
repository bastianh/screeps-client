/**
 * Version stamp for persistently cached terrain.
 *
 * Terrain is immutable in normal play, so the client caches it aggressively:
 * raw bytes in IndexedDB (via RoomStore) and baked map tiles in the browser
 * Cache API (client side). Neither is otherwise invalidated, so a server map
 * regeneration would keep serving stale terrain across reloads.
 *
 * Bump this constant to discard every previously cached room. It is folded into
 * the IndexedDB terrain key (here) and the client's `screeps-terrain-v{N}`
 * Cache-API name, so a single bump makes both layers miss and re-fetch /
 * re-bake fresh terrain.
 *
 * History: v1 was the original scheme (unversioned IndexedDB keys + a
 * `screeps-terrain-v1` tile cache); v2 is the first generation where both
 * layers track this constant together.
 */
export const TERRAIN_CACHE_VERSION = 2
