import { Graphics, Sprite } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { softGlowTexture } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Portal visuals: a dark well out of which a cyan ring keeps welling up and fading,
// swallowed from behind by a dark disc — the vanilla renderer's two stacked "waves"
// over a static base disc, plus a soft violet glow.
//
// Geometry follows the official metadata (tile = 100 units): base disc r=45, both
// waves r=40, drawn once at full size and animated purely by scale + alpha so nothing
// is re-drawn per frame.
export const PT_BASE_R    = TILE_SIZE * 0.45
export const PT_WAVE_R    = TILE_SIZE * 0.40
export const PT_DARK      = 0x111133   // well colour: base disc and the trailing dark wave
export const PT_CYAN      = 0x61C0ED   // leading wave
export const PT_ALPHA     = 0.5        // peak opacity of base disc and both waves
export const PT_CYCLE_MS  = 2000       // one full well-up per 2s, matching vanilla's 1s+1s sequence
export const PT_GLOW      = 0x9999FF
export const PT_GLOW_R    = TILE_SIZE * 0.70
export const PT_GLOW_MIN  = 0.25       // glow breathes between these alphas over one cycle
export const PT_GLOW_MAX  = 0.55

// Cyan wave: grows 0 → full over the first half of the cycle at PT_ALPHA, then holds
// full size and fades to nothing over the second half.
export function portalCyanWave(p: number): { scale: number; alpha: number } {
  return p < 0.5
    ? { scale: p * 2, alpha: PT_ALPHA }
    : { scale: 1, alpha: PT_ALPHA * (1 - (p - 0.5) * 2) }
}

// Dark wave: trails the cyan one — creeps out to 30% over the first half, then races
// to full size while fading, so the cyan ring is eaten from the inside out.
export function portalDarkWave(p: number): { scale: number; alpha: number } {
  return p < 0.5
    ? { scale: p * 2 * 0.3, alpha: PT_ALPHA }
    : { scale: 0.3 + (p - 0.5) * 2 * 0.7, alpha: PT_ALPHA * (1 - (p - 0.5) * 2) }
}

// Drives one portal's waves and glow from the free-running wall clock. Called each
// frame from ObjectLayer; `__portalPhase` offsets neighbouring portals so a pair
// either side of a sector centre doesn't pulse in lockstep.
export function animatePortal(visual: ContainerWithTarget, now: number): void {
  const cyan = visual.__portalCyanWave
  const dark = visual.__portalDarkWave
  if (!cyan || !dark) return
  const p = ((now / PT_CYCLE_MS) + (visual.__portalPhase ?? 0)) % 1

  const c = portalCyanWave(p)
  cyan.scale.set(c.scale)
  cyan.alpha = c.alpha

  const d = portalDarkWave(p)
  dark.scale.set(d.scale)
  dark.alpha = d.alpha

  const glow = visual.__portalGlow
  // Half-cycle breath (sin over the full cycle is 0 at both ends, which would blink);
  // cosine keeps it brightest mid-cycle and never fully dark.
  if (glow) glow.alpha = PT_GLOW_MIN + (PT_GLOW_MAX - PT_GLOW_MIN) * (0.5 - 0.5 * Math.cos(p * 2 * Math.PI))
}

export function createPortalVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy } = ctx

  // Soft violet glow underneath everything, so the well reads as lit rather than as a hole.
  const glow = new Sprite(softGlowTexture())
  glow.anchor.set(0.5)
  glow.position.set(cx, cy)
  glow.tint = PT_GLOW
  glow.width = glow.height = PT_GLOW_R * 2
  glow.alpha = PT_GLOW_MIN
  container.addChild(glow)

  // Static base disc.
  g.circle(cx, cy, PT_BASE_R)
  g.fill({ color: PT_DARK, alpha: PT_ALPHA })
  container.addChild(g)

  // Both waves are drawn centred on their own origin and positioned at the tile centre,
  // so scaling them expands about the centre rather than the tile corner.
  const cyanWave = new Graphics()
  cyanWave.circle(0, 0, PT_WAVE_R)
  cyanWave.fill(PT_CYAN)
  cyanWave.position.set(cx, cy)
  container.addChild(cyanWave)

  const darkWave = new Graphics()
  darkWave.circle(0, 0, PT_WAVE_R)
  darkWave.fill(PT_DARK)
  darkWave.position.set(cx, cy)
  container.addChild(darkWave)

  const pt = container as ContainerWithTarget
  pt.__portalGlow = glow
  pt.__portalCyanWave = cyanWave
  pt.__portalDarkWave = darkWave
  // Stable per-portal phase from its fixed position (the keeper-lair idiom).
  pt.__portalPhase = ((obj.x * 31 + obj.y * 17) % 97) / 97
  animatePortal(pt, performance.now())
}
