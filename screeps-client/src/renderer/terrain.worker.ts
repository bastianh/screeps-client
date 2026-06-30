import { TerrainType } from 'screeps-connectivity'
import {
  MINIMAP_PLAIN as TERRAIN_PLAIN,
  MINIMAP_WALL as TERRAIN_WALL,
  MINIMAP_SWAMP as TERRAIN_SWAMP,
} from './minimap.js'

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
  const { id, roomName, lod, raw, shard, colors } = e.data as {
    id: number,
    roomName: string,
    lod: number,
    raw: Uint8Array,
    shard: string,
    colors?: { plain?: string; swamp?: string; road?: string }
  }
  const useCustomColors = !!colors

  const size = LOD_SIZES[lod] || 128
  const T    = size / 50

  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D
  if (!ctx) return

  ctx.fillStyle = colors?.plain ?? hexToRgb(TERRAIN_PLAIN)
  ctx.fillRect(0, 0, size, size)

  if (lod >= 1) {
    ctx.fillStyle = colors?.swamp ?? hexToRgb(TERRAIN_SWAMP)
    drawRoundedLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = hexToRgb(TERRAIN_WALL)
    drawRoundedLayer(ctx, raw, TerrainType.Wall, T)
  } else {
    ctx.fillStyle = colors?.swamp ?? hexToRgb(TERRAIN_SWAMP)
    drawFlatLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = hexToRgb(TERRAIN_WALL)
    drawFlatLayer(ctx, raw, TerrainType.Wall, T)
  }

  // Deliver the baked tile immediately so it renders without waiting for the
  // cache encode. createImageBitmap copies the canvas (unlike
  // transferToImageBitmap, which would detach it and break the convertToBlob
  // below).
  const bitmap = await createImageBitmap(canvas)
  self.postMessage({ kind: 'bitmap', id, roomName, lod, bitmap }, { transfer: [bitmap] })

  // Encode the cache copy afterwards, still off the main thread. Skip when
  // custom decoration colors are active — the cached default bitmap must stay
  // intact so it can be restored when decorations are removed.
  if (!useCustomColors) {
    try {
      const blob = await canvas.convertToBlob({ type: 'image/webp' })
      const cacheBytes = await blob.arrayBuffer()
      self.postMessage(
        { kind: 'cache', shard, roomName, lod, cacheBytes, cacheType: blob.type },
        { transfer: [cacheBytes] },
      )
    } catch {
      // encoding unsupported/failed — skip caching this tile
    }
  }
}
