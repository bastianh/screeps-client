import { Assets, type Texture } from 'pixi.js'
import { decorationTextureUrl } from './decorationTextureUrl.js'

const pending = new Map<string, Promise<Texture>>()

/**
 * Load a decoration texture by its API URL, deduplicated across layers and room
 * switches. Failures are dropped from the cache so a later visit retries instead
 * of replaying a rejected promise forever.
 */
export function loadDecorationTexture(url: string): Promise<Texture> {
  const src = decorationTextureUrl(url)
  let promise = pending.get(src)
  if (!promise) {
    promise = Assets.load<Texture>(src).catch((err) => {
      pending.delete(src)
      throw err
    })
    pending.set(src, promise)
  }
  return promise
}
