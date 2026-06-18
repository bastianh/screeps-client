import { createLogger } from '~/utils/log.js'

const { warn } = createLogger('terrainCache')

const CACHE_NAME = 'screeps-terrain-v1'

export async function getTerrainCacheBlob(shard: string, roomName: string, lod: number): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const key = `/terrain/${shard}_${roomName}_z${lod}.webp`
    const req = new Request(key)
    const res = await cache.match(req)
    if (res) {
      return await res.blob()
    }
  } catch (err) {
    warn('get failed:', err)
  }
  return null
}

export async function saveTerrainCacheBlob(shard: string, roomName: string, lod: number, blob: Blob): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const key = `/terrain/${shard}_${roomName}_z${lod}.webp`
    const req = new Request(key)
    const res = new Response(blob)
    await cache.put(req, res)
  } catch (err) {
    warn('save failed:', err)
  }
}

export async function imageBitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D context not available')
  ctx.drawImage(bitmap, 0, 0)
  return await canvas.convertToBlob({ type: 'image/webp' })
}

// Safari/WebKit rejects createImageBitmap(blob) for Cache-API blobs with an
// "access control checks" error (it treats the internal blob: URL as
// cross-origin). Decoding via an HTMLImageElement object URL is unaffected and
// works in every browser, so we detect the gap once and then stay on the
// fallback path. Both branches return an ImageBitmap so callers can still
// .close() the result.
let blobBitmapSupported: boolean | null = null

export async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  if (blobBitmapSupported !== false) {
    try {
      const bitmap = await createImageBitmap(blob)
      blobBitmapSupported = true
      return bitmap
    } catch (err) {
      // Once we know the direct path works, a later failure is a real decode
      // error and must propagate rather than silently switching strategies.
      if (blobBitmapSupported === true) throw err
      blobBitmapSupported = false
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await createImageBitmap(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}
