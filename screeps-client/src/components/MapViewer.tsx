import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { MapRenderer } from '~/renderer/MapRenderer.js'
import { client, userInfo, worldBounds, setWorldBounds } from '~/stores/clientStore.js'
import { showMapRoomNames, showUnclaimableRooms, showMapVisuals } from '~/stores/settingsStore.js'
import { mapOverlayMode } from '~/stores/mapOverlayStore.js'
import { parseRoomName, formatRoomName, isRoomInWorld, isBusRoom, isCenterRoom } from '~/utils/roomName.js'
import { useRoomNavigationKeys } from '~/utils/useRoomNavigationKeys.js'
import { createLogger } from '~/utils/log.js'
import type { Map2Subscription, Badge } from 'screeps-connectivity'

const { log, error } = createLogger('map')

export interface RoomInfo {
  room: string
  /** Owner username (controller level ≥ 1); null when the room is unowned. */
  owner: string | null
  /** Reserver username (controller level 0); null when the room is not reserved. */
  reservation: string | null
  /** Controller level (RCL); null when unowned. */
  level: number | null
  mineral: string | null
  density: number | null
  /** Badge of the owner or reserver, for display next to their name. */
  badge: Badge | null
  /** Controller sign, with the signer's name/badge resolved. */
  sign: { text: string; datetime: number; username: string | null; badge: Badge | null } | null
}

interface MapViewerProps {
  shard: string | null
  originRoom?: string
  initialZoom?: number
  onNavigateToRoom: (room: string) => void
  onHoveredRoomChanged?: (info: RoomInfo | null) => void
  onSelectedRoomChanged?: (info: RoomInfo | null) => void
  onZoomChanged?: (zoom: number) => void
  onSubscriptionStateChanged?: (active: boolean) => void
}

export function MapViewer(props: MapViewerProps) {
  let canvasRef: HTMLCanvasElement | undefined
  let renderer: MapRenderer | null = null

  const [visibleRooms, setVisibleRooms] = createSignal<string[]>([])
  const [zoom, setZoom] = createSignal(1)
  const origin = () => props.originRoom
  const [selectedRoom, setSelectedRoom] = createSignal<string | null>(origin() ?? null)
  let lastSubsActive: boolean | null = null
  let lastRoomsEmpty: boolean | null = null

  // key = `${room}/${shard}` so shard changes invalidate existing subs
  const map2Subs = new Map<string, Map2Subscription>()

  // Per-room stats received from the library's mapStats store via events
  const roomStats = new Map<string, { own?: { user: string; level: number }; mineral?: string; density?: number; username?: string; safeMode?: boolean; badge?: import('screeps-connectivity').Badge; sign?: { user: string; text: string; datetime: number; username?: string; badge?: import('screeps-connectivity').Badge } }>()

  // Precomputed unclaimable state per room — survives the stats-before-terrain race.
  const roomUnclaimable = new Map<string, 'none' | 'own' | 'other'>()

  // Fast change-detection for badges: roomName → JSON key of last seen badge.
  // If the key hasn't changed we skip re-rendering the badge entirely.
  const roomBadgeKeys = new Map<string, string>()

  const canNavigateTo = (room: string): boolean => {
    const bounds = worldBounds()
    if (!bounds) return true // server doesn't provide world-size → allow all
    const coord = parseRoomName(room)
    return !!coord && isRoomInWorld(coord.x, coord.y, bounds)
  }

  const buildRoomInfo = (room: string): RoomInfo => {
    const stat = roomStats.get(room)
    const own = stat?.own
    // Map-stats encodes a reservation as own with level 0; ownership is level ≥ 1.
    const name = stat?.username ?? (own?.user ? `user:${own.user}` : null)
    const owned = !!own && own.level >= 1
    const reserved = !!own && own.level === 0
    const sign = stat?.sign
    return {
      room,
      owner: owned ? name : null,
      reservation: reserved ? name : null,
      level: owned ? own!.level : null,
      mineral: stat?.mineral ?? null,
      density: stat?.density ?? null,
      badge: stat?.badge ?? null,
      sign: sign
        ? {
            text: sign.text,
            datetime: sign.datetime,
            // Fall back to user:<id> when the signer isn't in the user map, matching the owner path.
            username: sign.username ?? (sign.user ? `user:${sign.user}` : null),
            badge: sign.badge ?? null,
          }
        : null,
    }
  }

  // Terrain is fetched progressively in batches, sorted center-out
  const TERRAIN_BATCH_SIZE = 200
  const TERRAIN_BATCH_MS = 0
  let terrainQueue: string[] = []
  let terrainTimer: ReturnType<typeof setTimeout> | null = null
  // Rooms whose terrain is fetched/baking but not yet rendered. hasRoom() only
  // turns true once the bake completes, so without this the effect re-queues
  // in-flight rooms on every visibleRooms change — duplicate fetches + bakes.
  const requested = new Set<string>()

  const drainTerrain = () => {
    terrainTimer = null
    const c = client()
    if (!c || !renderer) return
    const vis = new Set(visibleRooms())
    terrainQueue = terrainQueue.filter(r => vis.has(r) && !renderer!.hasRoom(r) && !requested.has(r))
    if (terrainQueue.length === 0) return
    const batch = terrainQueue.splice(0, TERRAIN_BATCH_SIZE)
    for (const r of batch) requested.add(r)
    c.stores.room.terrainBulk(batch, props.shard)
      .then(async terrainMap => {
        const bakes: Promise<void>[] = []
        for (const [room, terrain] of terrainMap) {
          const p = renderer?.setRoomTerrain(room, terrain)
          if (p) bakes.push(p)
          const unclaimable = roomUnclaimable.get(room)
          if (unclaimable !== undefined) renderer?.setRoomOwned(room, unclaimable)
        }
        for (const room of batch) {
          if (!terrainMap.has(room)) renderer?.markRoomFetched(room)
        }
        // Keep rooms marked in-flight until their bake finishes (hasRoom() turns
        // true), otherwise they could be re-queued in the gap before that.
        await Promise.all(bakes)
      })
      .catch(err => error('terrain fetch failed:', err))
      .finally(() => {
        for (const r of batch) requested.delete(r)
        if (terrainQueue.length > 0) terrainTimer = setTimeout(drainTerrain, TERRAIN_BATCH_MS)
      })
  }

  // Drop local room stats when connection or shard changes
  createEffect(() => {
    client()
    void props.shard
    roomStats.clear()
    roomUnclaimable.clear()
  })

  onMount(() => {
    if (!canvasRef) return

    ;(async () => {
      renderer = new MapRenderer({
        onRoomHover: (room) => {
          props.onHoveredRoomChanged?.(room ? buildRoomInfo(room) : null)
        },
        onRoomClick: (room) => {
          if (selectedRoom() !== room) {
            setSelectedRoom(room)
            renderer?.setSelectedRoom(room)
            props.onSelectedRoomChanged?.(buildRoomInfo(room))
          } else {
            // Defer navigation out of the PixiJS event handler. Calling onNavigateToRoom
            // synchronously triggers SolidJS to unmount this component and destroy the
            // renderer — while still inside PixiJS's _onPointerUp pipeline — causing
            // EventSystem.setCursor to crash on a null domElement.
            if (canNavigateTo(room)) setTimeout(() => props.onNavigateToRoom(room), 0)
          }
        },
        onVisibleRoomsChanged: (rooms) => {
          const isEmpty = rooms.length === 0
          if (lastRoomsEmpty !== isEmpty) {
            lastRoomsEmpty = isEmpty
            if (isEmpty) {
              log('zoom out — too many rooms visible, terrain loading paused')
            } else {
              log(`zoom in — terrain loading active, ${rooms.length} rooms visible`)
            }
          }
          setVisibleRooms(rooms)
        },
        onZoomChanged: (z) => {
          setZoom(z)
          props.onZoomChanged?.(z)
        },
      })

      await renderer.init(canvasRef!)
      if (!renderer) return
      if (props.initialZoom !== undefined && props.initialZoom > 0) {
        renderer.setZoom(props.initialZoom)
      }
      props.onZoomChanged?.(renderer.zoom)
      // Apply world bounds immediately if already known (worldInfo arrived before renderer init)
      const initialBounds = worldBounds()
      if (initialBounds) renderer.setBounds(initialBounds.minX, initialBounds.maxX, initialBounds.minY, initialBounds.maxY)

      if (props.originRoom) {
        const coord = parseRoomName(props.originRoom)
        if (coord) renderer.centerOn(coord.x, coord.y)
        renderer.setSelectedRoom(props.originRoom)
        props.onSelectedRoomChanged?.(buildRoomInfo(props.originRoom))
      } else {
        const c = client()
        if (c) {
          try {
            const res = await c.http.user.worldStartRoom(props.shard ?? 'shard0') as { room?: string | string[] }
            if (!renderer) return
            const roomName = Array.isArray(res?.room) ? res.room[0] : res?.room
            if (typeof roomName === 'string') {
              const coord = parseRoomName(roomName)
              if (coord) renderer.centerOn(coord.x, coord.y)
            }
          } catch (err) {
            error('worldStartRoom failed:', err)
          }
        }
      }

      if (!renderer) return
    })()
  })

  onCleanup(() => {
    if (terrainTimer !== null) { clearTimeout(terrainTimer); terrainTimer = null }
    terrainQueue = []
    requested.clear()
    for (const sub of map2Subs.values()) sub.dispose()
    map2Subs.clear()
    renderer?.destroy()
    renderer = null
  })

  // Arrow key navigation (moves map selection) + 'm' to enter room view
  createEffect(() => {
    const moveSelection = (rx: number, ry: number) => {
      const name = formatRoomName(rx, ry)
      setSelectedRoom(name)
      renderer?.setSelectedRoom(name)
      renderer?.centerOn(rx, ry, true)
      props.onSelectedRoomChanged?.(buildRoomInfo(name))
      props.onHoveredRoomChanged?.(buildRoomInfo(name))
    }

    useRoomNavigationKeys({
      currentRoom: selectedRoom,
      worldBounds,
      onMove: moveSelection,
    })

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      const editable = (e.target as HTMLElement | null)?.isContentEditable ?? false
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return
      if (e.key === 'm') {
        const cur = selectedRoom()
        if (cur && canNavigateTo(cur)) props.onNavigateToRoom(cur)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  // Fetch terrain + stats, manage map2 subscriptions when visible rooms or shard change
  createEffect(() => {
    const c = client()
    const rooms = visibleRooms()
    const shard = props.shard
    if (!c || rooms.length === 0) return

    const visibleSet = new Set(rooms)

    // Queue new rooms for progressive terrain loading, sorted center-out
    const newRooms = rooms.filter(r => !renderer?.hasRoom(r) && !requested.has(r))
    if (newRooms.length > 0) {
      const cx = rooms.reduce((s, r) => s + (parseRoomName(r)?.x ?? 0), 0) / rooms.length
      const cy = rooms.reduce((s, r) => s + (parseRoomName(r)?.y ?? 0), 0) / rooms.length
      terrainQueue = newRooms.slice().sort((a, b) => {
        const ca = parseRoomName(a), cb = parseRoomName(b)
        const da = ca ? Math.abs(ca.x - cx) + Math.abs(ca.y - cy) : 999
        const db = cb ? Math.abs(cb.x - cx) + Math.abs(cb.y - cy) : 999
        return da - db
      })
      if (terrainTimer === null) terrainTimer = setTimeout(drainTerrain, 0)
    }

    // Queue all visible rooms for a batched mapStats fetch.
    // The library debounces for 100 ms, then fires per-room events.
    c.stores.mapStats.request(rooms, 'owner0', shard ?? undefined)

    // Reconcile map2 subscriptions — drop all when zoomed out.
    // The library (MapStore) handles its own per-server limit via a waitlist.
    const subsActive = zoom() >= 0.4
    if (subsActive !== lastSubsActive) {
      lastSubsActive = subsActive
      props.onSubscriptionStateChanged?.(subsActive)
      if (!subsActive) renderer?.clearAllMap2()
    }
    if (!subsActive) {
      for (const [, sub] of map2Subs) sub.dispose()
      map2Subs.clear()
    } else {
      const activeKeys = new Set(rooms.map((r) => `${r}/${shard}`))
      for (const [key, sub] of map2Subs) {
        if (!activeKeys.has(key)) {
          sub.dispose()
          map2Subs.delete(key)
          renderer?.clearRoomMap2(key.split('/')[0])
        }
      }
      for (const room of rooms) {
        const key = `${room}/${shard}`
        if (!map2Subs.has(key)) {
          map2Subs.set(key, c.stores.map.subscribeMap2(room, shard))
        }
      }
    }

    // Remove containers for rooms that left the viewport to cap memory usage
    renderer?.clearInvisibleRooms(visibleSet)
  })

  // Sync room name label visibility when the setting changes
  createEffect(() => {
    renderer?.setShowRoomNames(showMapRoomNames())
    if (renderer) renderer.currentShard = props.shard ?? 'shard0'
  })

  // Sync unclaimable overlay visibility when the setting changes
  createEffect(() => {
    renderer?.setUnclaimableOverlayVisible(showUnclaimableRooms())
  })

  // Sync map visuals visibility when the setting changes
  createEffect(() => {
    renderer?.setMapVisualVisible(showMapVisuals())
  })

  // Sync overlay mode (owner / mineral / none)
  createEffect(() => {
    renderer?.setOverlayMode(mapOverlayMode())
  })

  // Re-fetch world bounds with the correct shard whenever client or shard changes.
  // clientStore fetches without shard on connect which gives NaN bounds on multi-shard servers.
  createEffect(() => {
    const c = client()
    const shard = props.shard
    if (!c) return
    c.stores.server.worldInfo(shard ?? undefined).then((info) => {
      log(`worldInfo(shard=${shard ?? 'none'}) — x: [${info.minX}, ${info.maxX}]  y: [${info.minY}, ${info.maxY}]`)
      setWorldBounds(info)
    }).catch((e) => {
      log(`worldInfo(shard=${shard ?? 'none'}) failed:`, e)
    })
  })

  // Sync current user ID to renderer so map2 dots use the right colour
  createEffect(() => {
    renderer?.setCurrentUser(userInfo()?._id ?? null)
  })

  // Draw world bounds border when worldBounds signal updates (renderer already ready at this point)
  createEffect(() => {
    const bounds = worldBounds()
    if (!bounds) {
      renderer?.clearBounds()
      log(`worldBounds — none (shard: ${props.shard ?? 'none'})`)
    } else {
      renderer?.setBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY)
      log(`worldBounds applied — shard: ${props.shard ?? 'none'}  x: [${bounds.minX}, ${bounds.maxX}]  y: [${bounds.minY}, ${bounds.maxY}]  (fetched for shard: ${bounds.shard ?? 'none'})`)
    }
  })

  // Map visual subscription — wired once per client+shard combination
  createEffect(() => {
    const c = client()
    if (!c) return

    const sub = c.stores.user.subscribeMapVisual(props.shard)
    // Long-lived listener: reads props.shard at invocation time.
    // eslint-disable-next-line solid/reactivity
    const listenerSub = c.stores.user.on('user:mapVisual', ({ shard, data }) => {
      if (shard !== props.shard) return
      if (data) renderer?.setMapVisual(data)
      else renderer?.clearMapVisual()
    })

    onCleanup(() => {
      sub.dispose()
      listenerSub.dispose()
    })
  })

  // Single map2 update listener — re-wired if client reconnects
  createEffect(() => {
    const c = client()
    if (!c) return

    // Long-lived listener: must read live props.shard at invocation time to
    // filter for the currently viewed shard. The reactivity lint is suppressed
    // because re-binding on every shard change would drop in-flight events.
    // eslint-disable-next-line solid/reactivity
    const sub = c.stores.map.on('room:map2update', ({ room, shard, data, source }) => {
      if (shard !== props.shard) return
      renderer?.setRoomMap2(room, data, source)
    })

    onCleanup(() => sub.dispose())
  })

  // MapStats update listener — per-room events from the library store
  createEffect(() => {
    const c = client()
    if (!c) return

    const me = userInfo()?._id
    const visibleSet = new Set(visibleRooms())

    // eslint-disable-next-line solid/reactivity
    const sub = c.stores.mapStats.on('mapStats:room', ({ room, stat }) => {
      roomStats.set(room, stat)
      const coord = parseRoomName(room)
      const structurallyUnclaimable = coord ? (isBusRoom(coord.x, coord.y) || isCenterRoom(coord.x, coord.y)) : false
      const prohibited = stat.status === 'out of borders'
      const ownRoom = !!(stat.own && stat.own.user === me)
      const enemyOwned = !!(stat.own && stat.own.user !== me)
      const unclaimableState: 'none' | 'own' | 'other' = ownRoom ? 'own' : (structurallyUnclaimable || prohibited || enemyOwned) ? 'other' : 'none'
      roomUnclaimable.set(room, unclaimableState)
      if (visibleSet.has(room)) {
        renderer?.setRoomOwned(room, unclaimableState)
        renderer?.setRoomSafeMode(room, !!stat.safeMode)
      }

      renderer?.setRoomMineral(room, stat.mineral, stat.density)

      // Badge change-check: cheap string comparison, runs only on event, never per tick.
      const badgeKey = stat.badge ? JSON.stringify(stat.badge) : ''
      if (roomBadgeKeys.get(room) !== badgeKey) {
        roomBadgeKeys.set(room, badgeKey)
        renderer?.setRoomBadge(room, stat.badge, stat.own?.level)
      }

      const sel = selectedRoom()
      if (sel === room) {
        props.onSelectedRoomChanged?.(buildRoomInfo(room))
      }
    })

    onCleanup(() => sub.dispose())
  })

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={(el) => canvasRef = el} style={{ display: 'block' }} />
    </div>
  )
}
