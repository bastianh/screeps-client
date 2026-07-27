import { TerrainType } from 'screeps-connectivity'
import { decorationTextureUrl } from './decorationTextureUrl.js'
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

interface TextureOverlay {
  url: string
  tint: number
  alpha: number
  target: 'floor' | 'wall'
}

interface GraffitiSprite {
  url: string
  tint?: number
  x: number
  y: number
  width: number
  height: number
  alpha: number
  tiling: boolean
  tileScale: number
}

interface DecorationMessage {
  colors: { plain?: string; swamp?: string; wall?: string; road?: string }
  overlays: TextureOverlay[]
  graffiti: GraffitiSprite[]
}

// Decoration textures, shared across rooms and LODs. A rejected load is cached as null so
// one broken URL doesn't re-hit the network for every room that references it.
const textureCache = new Map<string, Promise<ImageBitmap | null>>()

function loadTexture(url: string): Promise<ImageBitmap | null> {
  let pending = textureCache.get(url)
  if (!pending) {
    pending = fetch(decorationTextureUrl(url))
      .then(res => res.ok ? res.blob() : Promise.reject(new Error(String(res.status))))
      .then(blob => createImageBitmap(blob))
      .catch(() => null)
    textureCache.set(url, pending)
  }
  return pending
}

/**
 * An opaque stencil of the room's walls (`wall`) or of everything else (`floor`).
 *
 * Built on its own canvas rather than composited straight onto the layer: the LOD-0 path
 * draws one rect per tile, and `destination-in` is a whole-canvas operation — applying it
 * per rect would erase everything outside each individual tile.
 */
function terrainMask(size: number, raw: Uint8Array, T: number, lod: number, mode: 'floor' | 'wall'): OffscreenCanvas {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.fillStyle = '#fff'
  if (mode === 'floor') {
    ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'destination-out'
  }
  if (lod >= 1) drawRoundedLayer(ctx, raw, TerrainType.Wall, T)
  else drawFlatLayer(ctx, raw, TerrainType.Wall, T)
  return canvas
}

/** Multiply a tint over the layer, then restore the artwork's own alpha. */
function tintLayer(ctx: OffscreenCanvasRenderingContext2D, size: number, tint: number, redraw: () => void): void {
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = hexToRgb(tint)
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'destination-in'
  redraw()
  ctx.globalCompositeOperation = 'source-over'
}

async function drawOverlays(
  ctx: OffscreenCanvasRenderingContext2D,
  overlays: TextureOverlay[],
  size: number,
  raw: Uint8Array,
  T: number,
  lod: number,
): Promise<void> {
  for (const item of overlays) {
    const image = await loadTexture(item.url)
    if (!image) continue

    const layer = new OffscreenCanvas(size, size)
    const lctx = layer.getContext('2d') as OffscreenCanvasRenderingContext2D
    const draw = () => lctx.drawImage(image, 0, 0, size, size)

    draw()
    tintLayer(lctx, size, item.tint, draw)

    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(terrainMask(size, raw, T, lod, item.target), 0, 0)

    ctx.globalAlpha = item.alpha
    ctx.drawImage(layer, 0, 0)
    ctx.globalAlpha = 1
  }
}

async function drawGraffiti(
  ctx: OffscreenCanvasRenderingContext2D,
  items: GraffitiSprite[],
  size: number,
  raw: Uint8Array,
  T: number,
  lod: number,
): Promise<void> {
  if (items.length === 0) return
  const mask = terrainMask(size, raw, T, lod, 'wall')

  for (const item of items) {
    const image = await loadTexture(item.url)
    if (!image) continue

    const x = item.x * T
    const y = item.y * T
    const w = item.width * T
    const h = item.height * T

    const layer = new OffscreenCanvas(size, size)
    const lctx = layer.getContext('2d') as OffscreenCanvasRenderingContext2D
    const draw = () => {
      if (item.tiling) {
        const pattern = lctx.createPattern(image, 'repeat')
        if (!pattern) return
        // The reference tiles in normalised room units with `tileScale / (50 * 100)`
        // per texture pixel; scaled to this canvas that is `tileScale * size / 5000`.
        const scale = (item.tileScale * size) / 5000
        pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, x, y]))
        lctx.fillStyle = pattern
        lctx.fillRect(x, y, w, h)
      } else {
        lctx.drawImage(image, x, y, w, h)
      }
    }

    draw()
    if (item.tint != null) tintLayer(lctx, size, item.tint, draw)

    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(mask, 0, 0)

    ctx.globalAlpha = item.alpha
    ctx.drawImage(layer, 0, 0)
    ctx.globalAlpha = 1
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { id, roomName, lod, raw, shard, decoration } = e.data as {
    id: number,
    roomName: string,
    lod: number,
    raw: Uint8Array,
    shard: string,
    decoration?: DecorationMessage
  }
  const colors = decoration?.colors
  const useCustomColors = !!decoration

  const size = LOD_SIZES[lod] || 128
  const T    = size / 50

  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D
  if (!ctx) return

  ctx.fillStyle = colors?.plain ?? hexToRgb(TERRAIN_PLAIN)
  ctx.fillRect(0, 0, size, size)

  const swampColor = colors?.swamp ?? hexToRgb(TERRAIN_SWAMP)
  const wallColor = colors?.wall ?? hexToRgb(TERRAIN_WALL)
  if (lod >= 1) {
    ctx.fillStyle = swampColor
    drawRoundedLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = wallColor
    drawRoundedLayer(ctx, raw, TerrainType.Wall, T)
  } else {
    ctx.fillStyle = swampColor
    drawFlatLayer(ctx, raw, TerrainType.Swamp, T)
    ctx.fillStyle = wallColor
    drawFlatLayer(ctx, raw, TerrainType.Wall, T)
  }

  if (decoration) {
    await drawOverlays(ctx, decoration.overlays, size, raw, T, lod)
    await drawGraffiti(ctx, decoration.graffiti, size, raw, T, lod)
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
