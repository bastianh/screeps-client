/**
 * In dev, route Screeps S3 decoration textures through the Vite proxy to avoid CORS.
 *
 * Kept dependency-free so the terrain bake worker can share it with the main thread
 * without dragging PixiJS into the worker bundle.
 */
export function decorationTextureUrl(url: string): string {
  if (import.meta.env.DEV && url.startsWith('https://s3.amazonaws.com/')) {
    return url.replace('https://s3.amazonaws.com', '/__screeps_s3__')
  }
  return url
}
