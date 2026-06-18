import { TerrainType } from 'screeps-connectivity'

const TERRAIN_PLAIN = 0x2d333b
const TERRAIN_WALL  = 0x0d1117
const TERRAIN_SWAMP = 0x3d5a3d

const LOD_SIZES = [128, 512]

function hexToRgb(hex: number): string {
  return `rgb(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255})`
}

// Math.round-snapped coords prevent subpixel gaps between adjacent tiles
function drawFlatLayer(ctx: OffscreenCanvasRenderingContext2D, raw: Uint8Array, targetType: number, T: number) {
  for (let i = 0; i < 2500; i++) {
    if (raw[i] === targetType) {
      const x = i % 50
      const y = Math.floor(i / 50)
      const x1 = Math.round(x * T)
      const y1 = Math.round(y * T)
      ctx.fillRect(x1, y1, Math.round((x + 1) * T) - x1, Math.round((y + 1) * T) - y1)
    }
  }
}

function drawRoundedLayer(ctx: OffscreenCanvasRenderingContext2D, raw: Uint8Array, targetType: number, T: number) {
  const R  = T / 2
  const PI = Math.PI

  ctx.beginPath()

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const center = raw[y * 50 + x]           === targetType
      const top    = y > 0  && raw[(y - 1) * 50 + x]     === targetType
      const bottom = y < 49 && raw[(y + 1) * 50 + x]     === targetType
      const left   = x > 0  && raw[y * 50 + (x - 1)]     === targetType
      const right  = x < 49 && raw[y * 50 + (x + 1)]     === targetType
      const cx = x * T + R
      const cy = y * T + R

      // Top-Left Quadrant
      if (center) {
        if (!top && !left && y > 0 && x > 0) {
          ctx.moveTo(cx, y * T)
          ctx.arc(cx, cy, R, -PI / 2, PI, true)
          ctx.lineTo(cx, cy)
        } else {
          ctx.rect(x * T, y * T, R, R)
        }
      } else if (top && left && raw[(y - 1) * 50 + (x - 1)] === targetType) {
        ctx.moveTo(cx, y * T)
        ctx.lineTo(x * T, y * T)
        ctx.lineTo(x * T, cy)
        ctx.arc(cx, cy, R, PI, -PI / 2, false)
      }

      // Top-Right Quadrant
      if (center) {
        if (!top && !right && y > 0 && x < 49) {
          ctx.moveTo(cx, y * T)
          ctx.arc(cx, cy, R, -PI / 2, 0, false)
          ctx.lineTo(cx, cy)
        } else {
          ctx.rect(cx, y * T, R, R)
        }
      } else if (top && right && raw[(y - 1) * 50 + (x + 1)] === targetType) {
        ctx.moveTo(cx, y * T)
        ctx.lineTo(x * T + T, y * T)
        ctx.lineTo(x * T + T, cy)
        ctx.arc(cx, cy, R, 0, -PI / 2, true)
      }

      // Bottom-Left Quadrant
      if (center) {
        if (!bottom && !left && y < 49 && x > 0) {
          ctx.moveTo(x * T, cy)
          ctx.arc(cx, cy, R, PI, PI / 2, true)
          ctx.lineTo(cx, cy)
        } else {
          ctx.rect(x * T, cy, R, R)
        }
      } else if (bottom && left && raw[(y + 1) * 50 + (x - 1)] === targetType) {
        ctx.moveTo(x * T, cy)
        ctx.lineTo(x * T, y * T + T)
        ctx.lineTo(cx, y * T + T)
        ctx.arc(cx, cy, R, PI / 2, PI, false)
      }

      // Bottom-Right Quadrant
      if (center) {
        if (!bottom && !right && y < 49 && x < 49) {
          ctx.moveTo(cx, y * T + T)
          ctx.arc(cx, cy, R, PI / 2, 0, true)
          ctx.lineTo(cx, cy)
        } else {
          ctx.rect(cx, cy, R, R)
        }
      } else if (bottom && right && raw[(y + 1) * 50 + (x + 1)] === targetType) {
        ctx.moveTo(cx, y * T + T)
        ctx.lineTo(x * T + T, y * T + T)
        ctx.lineTo(x * T + T, cy)
        ctx.arc(cx, cy, R, 0, PI / 2, false)
      }
    }
  }

  ctx.fill()
}

self.onmessage = async (e: MessageEvent) => {
  const { id, roomName, lod, raw } = e.data as {
    id: number,
    roomName: string,
    lod: number,
    raw: Uint8Array
  }

  const size = LOD_SIZES[lod] || 128
  const T    = size / 50

  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D
  if (!ctx) return

  ctx.fillStyle = hexToRgb(TERRAIN_PLAIN)
  ctx.fillRect(0, 0, size, size)

  if (lod >= 1) {
    ctx.fillStyle = hexToRgb(TERRAIN_SWAMP)
    drawRoundedLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = hexToRgb(TERRAIN_WALL)
    drawRoundedLayer(ctx, raw, TerrainType.Wall, T)
  } else {
    ctx.fillStyle = hexToRgb(TERRAIN_SWAMP)
    drawFlatLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = hexToRgb(TERRAIN_WALL)
    drawFlatLayer(ctx, raw, TerrainType.Wall, T)
  }

  // Encode the cache copy here, off the main thread. Baking many rooms at once
  // (zooming far out) used to run convertToBlob per tile on the main thread,
  // which froze the tab. Doing it in the worker keeps the UI responsive.
  // convertToBlob must run before transferToImageBitmap, which detaches the
  // canvas bitmap. If encoding is unsupported/fails we simply skip caching.
  let cacheBytes: ArrayBuffer | undefined
  let cacheType: string | undefined
  try {
    const blob = await canvas.convertToBlob({ type: 'image/webp' })
    cacheBytes = await blob.arrayBuffer()
    cacheType = blob.type
  } catch {
    cacheBytes = undefined
  }

  const bitmap = canvas.transferToImageBitmap()
  const transfer: Transferable[] = cacheBytes ? [bitmap, cacheBytes] : [bitmap]
  self.postMessage({ id, roomName, lod, bitmap, cacheBytes, cacheType }, { transfer })
}
