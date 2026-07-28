import { createEffect, createSignal, Show, onCleanup } from 'solid-js'
import { TerrainType, type RoomTerrain } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { MINIMAP_PLAIN, MINIMAP_SWAMP, MINIMAP_WALL, toCss } from '~/renderer/minimap.js'
import { BORDER, MUTED } from '~/components/theme.js'
import { PlacementFrame } from './PlacementFrame.js'
import type { EditorCapabilities, Placement, SizeBounds } from './positionEditor.js'

// Drag a decoration around a room. The room is drawn as flat terrain on a 2D canvas —
// walls are what matters here, since graffiti only shows on them. The frame and its
// gestures are shared with the in-room editor; this file owns only the terrain backdrop.

const CELL = 10
const ROOM_PX = CELL * 50

interface EditorProps {
  room: string
  shard: string | null
  placement: Placement
  capabilities: EditorCapabilities
  bounds: SizeBounds
  previewUrl?: string
  onChange: (placement: Placement) => void
}

function drawTerrain(canvas: HTMLCanvasElement, terrain: RoomTerrain): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = toCss(MINIMAP_PLAIN)
  ctx.fillRect(0, 0, ROOM_PX, ROOM_PX)

  for (const [type, color] of [[TerrainType.Swamp, MINIMAP_SWAMP], [TerrainType.Wall, MINIMAP_WALL]] as const) {
    ctx.fillStyle = toCss(color)
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        if (terrain.get(x, y) === type) ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
  }
}

export function DecorationPositionEditor(props: EditorProps) {
  let canvasRef: HTMLCanvasElement | undefined
  const [terrain, setTerrain] = createSignal<RoomTerrain | null>(null)

  createEffect(() => {
    const c = client()
    const room = props.room
    if (!c || !room) return
    let cancelled = false
    c.stores.room.terrain(room, props.shard)
      .then(t => { if (!cancelled) setTerrain(t) })
      .catch(() => { /* no terrain — the frame still works over a blank room */ })
    onCleanup(() => { cancelled = true })
  })

  createEffect(() => {
    const t = terrain()
    if (canvasRef && t) drawTerrain(canvasRef, t)
  })

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: `${ROOM_PX}px`,
          height: `${ROOM_PX}px`,
          border: `1px solid ${BORDER}`,
          'border-radius': '6px',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        <canvas ref={(el) => canvasRef = el} width={ROOM_PX} height={ROOM_PX} style={{ display: 'block' }} />

        <PlacementFrame
          placement={props.placement}
          capabilities={props.capabilities}
          bounds={props.bounds}
          cellSize={CELL}
          previewUrl={props.previewUrl}
          onChange={props.onChange}
        />
      </div>

      <div style={{ 'font-size': '11px', color: MUTED, 'text-align': 'center', 'margin-top': '6px', 'font-variant-numeric': 'tabular-nums' }}>
        {props.placement.x}, {props.placement.y}
        {' · '}
        {props.placement.width} × {props.placement.height}
        <Show when={props.capabilities.rotatable}>
          {' · '}{Math.round(props.placement.rotation * 180 / Math.PI)}°
        </Show>
      </div>
    </div>
  )
}
