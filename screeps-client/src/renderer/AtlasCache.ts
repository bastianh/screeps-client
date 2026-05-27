import { Assets, type Spritesheet, type Texture } from 'pixi.js'

export class AtlasCache {
  private readonly cache = new Map<string, Spritesheet>()
  private readonly pending = new Map<string, Promise<Spritesheet>>()

  getOrLoad(atlasUrl: string): Promise<Spritesheet> {
    const cached = this.cache.get(atlasUrl)
    if (cached) return Promise.resolve(cached)
    const inFlight = this.pending.get(atlasUrl)
    if (inFlight) return inFlight
    const p = Assets.load<Spritesheet>(atlasUrl).then(sheet => {
      this.cache.set(atlasUrl, sheet)
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
    return this.cache.get(atlasUrl)?.textures?.[frame]
  }

  destroy(): void {
    for (const [, sheet] of this.cache) sheet.destroy(true)
    this.cache.clear()
    this.pending.clear()
  }
}

export const sharedAtlasCache = new AtlasCache()
