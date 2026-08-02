import { Graphics, Sprite } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { softGlowTexture } from './common.js'
import { type ContainerWithTarget, type VisualBuildContext } from './types.js'

// Keeper-lair visuals: near-black disc with a red pupil and an expanding pulse glow.
// Keeper lair: a near-black disc with a small red pupil ring, over which a red pulse expands from
// the centre to almost fill the disc and fades. The pulse is one pre-baked radial-glow sprite
// animated by scale + alpha in the ticker, so nothing is re-drawn or allocated per frame.
export const KL_BODY_R      = TILE_SIZE * 0.45   // black-disc radius (leaves a thin tile margin)
export const KL_BODY_COLOR  = 0x0E0708           // near-black with a faint warm tint
export const KL_RIM_COLOR   = 0x2A1618           // dark rim, lifts the disc off the terrain
export const KL_RIM_W       = TILE_SIZE * 0.06
export const KL_RED         = 0xE24A46           // pupil + pulse red
export const KL_PUPIL_R     = TILE_SIZE * 0.17   // red pupil-ring outer radius
export const KL_PUPIL_HOLE  = TILE_SIZE * 0.085  // dark centre punched through the pupil ring
export const KL_PULSE_MS    = 2600               // one ping every 2.6s
export const KL_PULSE_MIN_R = TILE_SIZE * 0.10   // pulse starts near the centre
export const KL_PULSE_MAX_R = TILE_SIZE * 0.42   // …and swells to almost fill the black disc
export const KL_PULSE_ALPHA = 0.6                // peak opacity mid-ping

export function createKeeperLairVisual(ctx: VisualBuildContext): void {
  const { obj, container, g, cx, cy } = ctx
  // Black disc with a dark rim.
  g.circle(cx, cy, KL_BODY_R)
  g.fill(KL_BODY_COLOR)
  g.circle(cx, cy, KL_BODY_R)
  g.stroke({ width: KL_RIM_W, color: KL_RIM_COLOR })
  container.addChild(g)

  // Pulse glow (welling up from the centre) — sits above the disc, below the pupil.
  // Sized/faded each frame in tick(); starts at the minimum radius, invisible.
  const glow = new Sprite(softGlowTexture())
  glow.anchor.set(0.5)
  glow.position.set(cx, cy)
  glow.tint = KL_RED
  glow.alpha = 0
  glow.width = glow.height = KL_PULSE_MIN_R * 2
  container.addChild(glow)

  // Red pupil ring: a small red disc with a dark centre punched through to the body.
  const pupil = new Graphics()
  pupil.circle(cx, cy, KL_PUPIL_R)
  pupil.fill(KL_RED)
  pupil.circle(cx, cy, KL_PUPIL_HOLE)
  pupil.fill(KL_BODY_COLOR)
  container.addChild(pupil)

  const kl = container as ContainerWithTarget
  kl.__keeperGlow = glow
  // Stable per-lair phase from its fixed position so neighbours don't ping in lockstep.
  kl.__keeperPhase = ((obj.x * 31 + obj.y * 17) % 97) / 97
}
