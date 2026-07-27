import { Assets, type Texture } from 'pixi.js'

// In dev, route Screeps S3 decoration textures through the Vite proxy to avoid CORS.
function devProxyUrl(url: string): string {
  if (import.meta.env.DEV && url.startsWith('https://s3.amazonaws.com/')) {
    return url.replace('https://s3.amazonaws.com', '/__screeps_s3__')
  }
  return url
}

const pending = new Map<string, Promise<Texture>>()

/**
 * Load a decoration texture by its API URL, deduplicated across layers and room
 * switches. Failures are dropped from the cache so a later visit retries instead
 * of replaying a rejected promise forever.
 */
export function loadDecorationTexture(url: string): Promise<Texture> {
  const src = devProxyUrl(url)
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
