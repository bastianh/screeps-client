import { Assets, type Spritesheet, type Texture } from 'pixi.js'

export class AtlasCache {
  private readonly cache = new Map<string, Spritesheet>()
  private readonly pending = new Map<string, Promise<Spritesheet>>()
  // Flattened frame→texture lookup per atlas, combining the spritesheet with any
  // MultiPack-linked sheets (TexturePacker `related_multi_packs`). PixiJS keeps
  // linked-sheet frames in `sheet.linkedSheets[i].textures`, not the parent's
  // `.textures`, so we merge them here to keep lookups O(1) and pack-agnostic.
  private readonly frames = new Map<string, Record<string, Texture>>()

  getOrLoad(atlasUrl: string): Promise<Spritesheet> {
    const cached = this.cache.get(atlasUrl)
    if (cached) return Promise.resolve(cached)
    const inFlight = this.pending.get(atlasUrl)
    if (inFlight) return inFlight
    const p = Assets.load<Spritesheet>(atlasUrl).then(sheet => {
      this.cache.set(atlasUrl, sheet)
      this.frames.set(atlasUrl, mergeFrames(sheet))
      this.pending.delete(atlasUrl)
      return sheet
    }).catch(err => {
      this.pending.delete(atlasUrl)
      throw err
    })
    this.pending.set(atlasUrl, p)
    return p
  }

  getTexture(atlasUrl: string, frame: string): Texture | undefined {
    return this.frames.get(atlasUrl)?.[frame]
  }

  destroy(): void {
    for (const [, sheet] of this.cache) {
      for (const linked of sheet.linkedSheets ?? []) linked.destroy(true)
      sheet.destroy(true)
    }
    this.cache.clear()
    this.frames.clear()
    this.pending.clear()
  }
}

function mergeFrames(sheet: Spritesheet): Record<string, Texture> {
  const merged: Record<string, Texture> = { ...sheet.textures }
  for (const linked of sheet.linkedSheets ?? []) Object.assign(merged, linked.textures)
  return merged
}

export const sharedAtlasCache = new AtlasCache()
