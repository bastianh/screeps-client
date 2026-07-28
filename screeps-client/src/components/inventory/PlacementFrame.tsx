import { For, Show } from 'solid-js'
import { ACCENT } from '~/components/theme.js'
import {
  applyResize, angleTo, clampPlacement, normalizeAngle, RESIZE_HANDLES,
  type EditorCapabilities, type Placement, type ResizeHandle, type SizeBounds,
} from './positionEditor.js'

// The draggable frame itself: move, resize from eight handles, turn by the grip above it.
// Nothing here knows what it is drawn over — the 2D editor gives it a fixed 10px cell over
// its terrain canvas, the room view gives it the live camera's cell size over the PixiJS
// canvas. Both then get the same gesture, and the geometry stays in `positionEditor.ts`.

const HANDLE = 8
/** Distance from the frame's top edge to the rotate grip, in pixels. */
const ROTATE_ARM = 18

export interface PlacementFrameProps {
  placement: Placement
  capabilities: EditorCapabilities
  bounds: SizeBounds
  /** Screen pixels per room cell. */
  cellSize: number
  /** Screen offset of cell (0,0) within the positioned parent. */
  originX?: number
  originY?: number
  previewUrl?: string
  /** Opacity of the preview image inside the frame. */
  previewOpacity?: number
  onChange: (placement: Placement) => void
  /** Fired once when a gesture ends, whether or not anything moved. */
  onGestureEnd?: () => void
}

/** Trim float noise from a drag so the API gets a tidy number. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100
}

function tidyPlacement(p: Placement): Placement {
  return { ...p, x: tidy(p.x), y: tidy(p.y), width: tidy(p.width), height: tidy(p.height) }
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

export function PlacementFrame(props: PlacementFrameProps) {
  let hostRef: HTMLDivElement | undefined

  const cell = () => props.cellSize
  const originX = () => props.originX ?? 0
  const originY = () => props.originY ?? 0

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
    const cellSize = cell()
    const startX = event.clientX
    const startY = event.clientY
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / cellSize
      const dy = (e.clientY - startY) / cellSize
      props.onChange(tidyPlacement(clampPlacement(update(dx, dy, start), bounds)))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      props.onGestureEnd?.()
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const startRotate = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const host = hostRef
    if (!host) return
    const start = props.placement
    const cellSize = cell()
    const box = host.getBoundingClientRect()
    const centreX = box.left + originX() + (start.x + start.width / 2) * cellSize
    const centreY = box.top + originY() + (start.y + start.height / 2) * cellSize
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
      props.onGestureEnd?.()
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const frameStyle = () => {
    const p = props.placement
    return {
      position: 'absolute' as const,
      left: `${originX() + p.x * cell()}px`,
      top: `${originY() + p.y * cell()}px`,
      width: `${p.width * cell()}px`,
      height: `${p.height * cell()}px`,
      transform: `rotate(${p.rotation}rad)`,
      'transform-origin': 'center',
      border: `1px solid ${ACCENT}`,
      cursor: props.capabilities.positionable ? 'move' : 'default',
      'touch-action': 'none',
      // The host spans the whole surface but must stay transparent to the pointer, or
      // it would swallow every click meant for the room underneath it.
      'pointer-events': 'auto' as const,
    }
  }

  return (
    <div ref={(el) => hostRef = el} style={{ position: 'absolute', inset: '0', 'pointer-events': 'none' }}>
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
              style={{
                width: '100%', height: '100%', 'object-fit': 'fill',
                opacity: String(props.previewOpacity ?? 0.85), 'pointer-events': 'none',
              }}
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
                  left: `${handleOffset(handle, props.placement.width * cell(), props.placement.height * cell()).left - HANDLE / 2}px`,
                  top: `${handleOffset(handle, props.placement.width * cell(), props.placement.height * cell()).top - HANDLE / 2}px`,
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
  )
}
