// Port of the reference renderer's src/lib/utils/hsl.js.
//
// Decoration `brightness` props scale HSL *lightness* — not the RGB channels.
// A plain channel multiply desaturates differently and visibly diverges from the
// official client for anything below ~0.8, so the conversion has to round-trip
// through HSL.

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/** RGB channels in [0,255] → `[h, s, l]` in [0,1]. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l] // achromatic

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  return [h / 6, s, l]
}

/** `[h, s, l]` in [0,1] → RGB channels in [0,255] (unclamped for l > 1). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v] // achromatic
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

function pack(r: number, g: number, b: number): number {
  const cr = Math.min(255, Math.max(0, Math.round(r)))
  const cg = Math.min(255, Math.max(0, Math.round(g)))
  const cb = Math.min(255, Math.max(0, Math.round(b)))
  return (cr << 16) | (cg << 8) | cb
}

/**
 * Scale a packed RGB colour's HSL saturation and lightness independently.
 *
 * The world-map decorations lean on this: the reference desaturates each layer by a
 * fixed factor (0.48 for walls, 0.5 for floors, 0.75/0.35 for the overlay textures) so
 * a room reads as a map tile rather than a scaled-down room view.
 */
export function scaleHsl(color: number, saturation: number, lightness: number): number {
  const [h, s, l] = rgbToHsl((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff)
  const [r, g, b] = hslToRgb(h, s * saturation, l * lightness)
  return pack(r, g, b)
}

/** Scale a packed RGB colour's HSL lightness by `brightness`. */
export function colorBrightness(color: number, brightness: number): number {
  return scaleHsl(color, 1, brightness)
}

/** Scale a packed RGB colour's channels by `factor` (used for the unlit pass). */
export function multiply(color: number, factor: number): number {
  return pack(
    ((color >> 16) & 0xff) * factor,
    ((color >> 8) & 0xff) * factor,
    (color & 0xff) * factor,
  )
}
