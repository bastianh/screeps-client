import { createEffect, createSignal, For, Show, onCleanup } from 'solid-js'
import { TerrainType, type RoomTerrain } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { MINIMAP_PLAIN, MINIMAP_SWAMP, MINIMAP_WALL, toCss } from '~/renderer/minimap.js'
import { BORDER, MUTED, ACCENT } from '~/components/theme.js'
import {
  applyResize, angleTo, clampPlacement, normalizeAngle, RESIZE_HANDLES,
  type EditorCapabilities, type Placement, type ResizeHandle, type SizeBounds,
} from './positionEditor.js'

// Drag a decoration around a room. The room is drawn as flat terrain on a 2D canvas —
// walls are what matters here, since graffiti only shows on them.

const CELL = 10
const ROOM_PX = CELL * 50
const HANDLE = 8
/** Distance from the frame's top edge to the rotate grip, in pixels. */
const ROTATE_ARM = 18

interface EditorProps {
  room: string
  shard: string | null
  placement: Placement
  capabilities: EditorCapabilities
  bounds: SizeBounds
  previewUrl?: string
  onChange: (placement: Placement) => void
}

/** Trim float noise from a drag so the API gets a tidy number. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100
}

function tidyPlacement(p: Placement): Placement {
  return { ...p, x: tidy(p.x), y: tidy(p.y), width: tidy(p.width), height: tidy(p.height) }
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

function handleOffset(handle: ResizeHandle, width: number, height: number): { left: number; top: number } {
  const left = handle.includes('w') ? 0 : handle.includes('e') ? width : width / 2
  const top = handle.includes('n') ? 0 : handle.includes('s') ? height : height / 2
  return { left, top }
}

function handleCursor(handle: ResizeHandle): string {
  if (handle === 'n' || handle === 's') return 'ns-resize'
  if (handle === 'e' || handle === 'w') return 'ew-resize'
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
  return 'nwse-resize'
}

export function DecorationPositionEditor(props: EditorProps) {
  let canvasRef: HTMLCanvasElement | undefined
  let frameHostRef: HTMLDivElement | undefined
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

  // One pointer gesture: capture the start state, then translate every move into a
  // placement. Cells, not pixels, so the maths matches the stored values.
  const startDrag = (
    event: PointerEvent,
    update: (dxCells: number, dyCells: number, start: Placement) => Placement,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    // Snapshot what the gesture needs — none of it may change mid-drag.
    const start = props.placement
    const bounds = props.bounds
    const startX = event.clientX
    const startY = event.clientY
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / CELL
      const dy = (e.clientY - startY) / CELL
      props.onChange(tidyPlacement(clampPlacement(update(dx, dy, start), bounds)))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const startRotate = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const host = frameHostRef
    if (!host) return
    const start = props.placement
    const box = host.getBoundingClientRect()
    const centreX = box.left + (start.x + start.width / 2) * CELL
    const centreY = box.top + (start.y + start.height / 2) * CELL
    // The grip sits above the frame, so its resting angle is -π/2; offset by that or
    // the decoration would jump a quarter turn the moment the drag begins.
    const grabbed = angleTo(centreX, centreY, event.clientX, event.clientY) + Math.PI / 2

    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    const move = (e: PointerEvent) => {
      const angle = angleTo(centreX, centreY, e.clientX, e.clientY) + Math.PI / 2
      props.onChange({ ...start, rotation: normalizeAngle(start.rotation + angle - grabbed) })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const frameStyle = () => {
    const p = props.placement
    return {
      position: 'absolute' as const,
      left: `${p.x * CELL}px`,
      top: `${p.y * CELL}px`,
      width: `${p.width * CELL}px`,
      height: `${p.height * CELL}px`,
      transform: `rotate(${p.rotation}rad)`,
      'transform-origin': 'center',
      border: `1px solid ${ACCENT}`,
      cursor: props.capabilities.positionable ? 'move' : 'default',
      'touch-action': 'none',
    }
  }

  return (
    <div>
      <div
        ref={(el) => frameHostRef = el}
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

        <div
          style={frameStyle()}
          onPointerDown={(e) => {
            if (!props.capabilities.positionable) return
            startDrag(e, (dx, dy, start) => ({ ...start, x: start.x + dx, y: start.y + dy }))
          }}
        >
          <Show when={props.previewUrl}>
            {(src) => (
              <img
                src={src()}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', 'object-fit': 'fill', opacity: 0.85, 'pointer-events': 'none' }}
              />
            )}
          </Show>

          <Show when={props.capabilities.rotatable}>
            <div
              onPointerDown={startRotate}
              title="Rotate"
              style={{
                position: 'absolute',
                left: `calc(50% - ${HANDLE / 2}px)`,
                top: `${-ROTATE_ARM}px`,
                width: `${HANDLE}px`,
                height: `${HANDLE}px`,
                'border-radius': '50%',
                background: ACCENT,
                cursor: 'grab',
                'touch-action': 'none',
              }}
            />
          </Show>

          <Show when={props.capabilities.resizable}>
            <For each={RESIZE_HANDLES}>
              {(handle) => (
                  <div
                    onPointerDown={(e) => {
                      const bounds = props.bounds
                      const proportional = props.capabilities.proportional
                      startDrag(e, (dx, dy, start) => applyResize(start, handle, dx, dy, bounds, proportional))
                    }}
                    style={{
                      position: 'absolute',
                      left: `${handleOffset(handle, props.placement.width * CELL, props.placement.height * CELL).left - HANDLE / 2}px`,
                      top: `${handleOffset(handle, props.placement.width * CELL, props.placement.height * CELL).top - HANDLE / 2}px`,
                      width: `${HANDLE}px`,
                      height: `${HANDLE}px`,
                      background: ACCENT,
                      cursor: handleCursor(handle),
                      'touch-action': 'none',
                    }}
                  />
              )}
            </For>
          </Show>
        </div>
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
