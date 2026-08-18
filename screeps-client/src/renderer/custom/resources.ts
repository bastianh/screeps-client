/**
 * Texture lookup for `sprite` processors.
 *
 * Mods register textures by name server-side (`config.backend.renderer.resources`)
 * and the URLs arrive under `/api/version` → `serverData.renderer.resources`. A URL
 * may contain the literal `{ASSETS_URL}`, the reference client's placeholder for
 * wherever it serves its own art from.
 */
import { Assets, Texture } from 'pixi.js'
import { softGlowTexture } from '../objects/common.js'
import { createLogger } from '~/utils/log.js'

const { warn } = createLogger('custom-renderer')

/** Names the reference client resolves from its own bundle rather than from a
 *  mod's `resources`. Mapped to our nearest equivalent so metadata copied from the
 *  stock examples (`texture: 'glow'`) renders instead of silently dropping out. */
const BUILTIN_TEXTURES: Record<string, () => Texture> = {
  glow: softGlowTexture,
}

let resourceUrls: Record<string, string> = {}
let assetsBase = ''

const resolved = new Map<string, Texture | null>()
const inFlight = new Map<string, Promise<Texture | null>>()

/**
 * Point `{ASSETS_URL}` at a base. We have no equivalent of the reference client's
 * own asset root, so this is the server origin's `/assets` — the only place a
 * private-server mod can realistically be serving files it also tells us about.
 * Verify against a real modded server before relying on it.
 */
export function setCustomResources(resources: Record<string, string> | undefined, serverBaseUrl: string): void {
  resourceUrls = resources ? { ...resources } : {}
  assetsBase = new URL('assets', serverBaseUrl).href.replace(/\/$/, '')
  resolved.clear()
  inFlight.clear()
}

function resourceUrl(name: string): string | null {
  const raw = resourceUrls[name]
  if (!raw) return null
  return raw.replace('{ASSETS_URL}', assetsBase)
}

/** A texture already usable this frame, or null if it needs loading (or doesn't exist). */
export function peekCustomTexture(name: string): Texture | null {
  const builtin = BUILTIN_TEXTURES[name]
  if (builtin) return builtin()
  const cached = resolved.get(name)
  if (cached !== undefined) return cached
  const url = resourceUrl(name)
  if (!url) return null
  // Pixi keeps parsed assets addressable by URL, so a texture another object
  // already pulled in is available without a second round trip.
  return (Assets.get(url) as Texture | undefined) ?? null
}

/** Load a named texture. Resolves to null when the name is unknown or the fetch fails. */
export function loadCustomTexture(name: string): Promise<Texture | null> {
  const ready = peekCustomTexture(name)
  if (ready) return Promise.resolve(ready)

  const pending = inFlight.get(name)
  if (pending) return pending

  const url = resourceUrl(name)
  if (!url) {
    warn('no resource registered for texture', name)
    resolved.set(name, null)
    return Promise.resolve(null)
  }

  const promise = Assets.load<Texture>(url)
    .then((texture) => {
      resolved.set(name, texture)
      return texture
    })
    .catch((err: unknown) => {
      warn('failed to load texture', name, url, err)
      // Cached as a miss so a broken URL is not re-fetched once per object per tick.
      resolved.set(name, null)
      return null
    })
    .finally(() => {
      inFlight.delete(name)
    })

  inFlight.set(name, promise)
  return promise
}
