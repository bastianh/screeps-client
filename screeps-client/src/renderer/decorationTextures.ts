import { Assets, type Texture } from 'pixi.js'
import { decorationTextureUrl } from './decorationTextureUrl.js'

const pending = new Map<string, Promise<Texture>>()

/**
 * Load a decoration texture by its API URL, deduplicated across layers and room
 * switches. Failures are dropped from the cache so a later visit retries instead
 * of replaying a rejected promise forever.
 *
 * Landscape overlays (floor/wall foregrounds) are fine, high-frequency patterns —
 * e.g. a 1024x1024 tile of thin lines — stretched or tiled over an entire room, so
 * they're almost always sampled well below their native resolution. PixiJS v8
 * defaults `autoGenerateMipmaps` to false; without a mip chain, minification falls
 * back to plain bilinear sampling, which reads only 4 texels per output pixel and
 * aliases away thin lines almost entirely instead of averaging them in. Turning
 * mipmaps on restores the contrast the same asset has in the official client.
 */
export function loadDecorationTexture(url: string): Promise<Texture> {
  const src = decorationTextureUrl(url)
  let promise = pending.get(src)
  if (!promise) {
    promise = Assets.load<Texture>(src).then((texture) => {
      texture.source.autoGenerateMipmaps = true
      texture.source.updateMipmaps()
      return texture
    }).catch((err) => {
      pending.delete(src)
      throw err
    })
    pending.set(src, promise)
  }
  return promise
}
