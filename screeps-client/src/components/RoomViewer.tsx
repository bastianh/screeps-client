import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { RoomRenderer } from '~/renderer/RoomRenderer.js'
import { createTerrainLayer } from '~/renderer/TerrainLayer.js'
import { ObjectLayer } from '~/renderer/ObjectLayer.js'
import { client } from '~/stores/clientStore.js'
import { parseRoomName, formatRoomName } from '~/utils/roomName.js'
import type { RoomTerrain, RoomObjectMap } from 'screeps-connectivity'
import { SubscriptionGroup } from 'screeps-connectivity'

interface RoomViewerProps {
  room: string
  shard: string
  onNavigate?: (room: string, shard: string) => void
}

export function RoomViewer(props: RoomViewerProps) {
  let containerRef: HTMLDivElement | undefined
  let objLayer: ObjectLayer | null = null
  const [renderer, setRenderer] = createSignal<RoomRenderer | null>(null)
  const [terrain, setTerrain] = createSignal<RoomTerrain | null>(null)
  const [objects, setObjects] = createSignal<RoomObjectMap | null>(null)
  const [gameTime, setGameTime] = createSignal<number | null>(null)

  onMount(async () => {
    if (!containerRef) return
    const r = await RoomRenderer.create(containerRef)
    setRenderer(r)
  })

  onCleanup(() => {
    objLayer?.destroy()
    objLayer = null
    const r = renderer()
    if (r) r.destroy()
  })

  // Load terrain and subscribe to room when room/shard changes
  createEffect(() => {
    const c = client()
    const r = renderer()
    if (!c || !r) return

    const room = props.room
    const shard = props.shard

    // Reset state
    setTerrain(null)
    setObjects(null)
    setGameTime(null)
    r.clear()
    r.resetView()
    objLayer?.destroy()
    objLayer = null

    // Setup navigation zones
    const coord = parseRoomName(room)
    if (coord && props.onNavigate) {
      r.setupNavigationZones({
        west: () => props.onNavigate!(formatRoomName(coord.x - 1, coord.y), shard),
        east: () => props.onNavigate!(formatRoomName(coord.x + 1, coord.y), shard),
        north: () => props.onNavigate!(formatRoomName(coord.x, coord.y - 1), shard),
        south: () => props.onNavigate!(formatRoomName(coord.x, coord.y + 1), shard),
      })
    }

    const group = new SubscriptionGroup()

    // Fetch terrain
    c.stores.room.terrain(room, shard)
      .then((t) => setTerrain(t))
      .catch((err) => console.error('Failed to load terrain:', err))

    // Fetch initial room objects
    c.stores.room.fetchObjects(room, shard)
      .catch((err) => console.error('Failed to load room objects:', err))

    // Subscribe to room updates
    group.add(c.stores.room.subscribe(room, shard))

    group.add(c.stores.room.on('room:update', (data) => {
      setObjects(data.objects)
      setGameTime(data.gameTime ?? null)
    }))

    onCleanup(() => {
      group.dispose()
    })
  })

  // Render terrain when it arrives
  createEffect(() => {
    const r = renderer()
    const t = terrain()
    if (!r || !t) return

    const layer = createTerrainLayer(t)
    r.world.addChild(layer)
    r.bringNavOverlayToTop()
  })

  // Render objects when they update
  createEffect(() => {
    const r = renderer()
    const objs = objects()
    if (!r || !objs) return

    if (!objLayer) {
      objLayer = new ObjectLayer(r.app.ticker)
      objLayer.container.label = 'objects'
      r.world.addChild(objLayer.container)
      r.bringNavOverlayToTop()
    }
    objLayer.update(objs)
  })

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {gameTime() !== null && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 10px',
            'border-radius': '4px',
            background: 'rgba(13, 17, 23, 0.8)',
            border: '1px solid #30363d',
            'font-size': '12px',
            color: '#8b949e',
          }}
        >
          Tick {gameTime()}
        </div>
      )}
    </div>
  )
}
