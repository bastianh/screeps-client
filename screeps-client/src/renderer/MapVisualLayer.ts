import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { MapVisualEntry, VisualStyle } from 'screeps-connectivity'
import { parseRoomName } from '~/utils/roomName.js'

// Keep in sync with MapRenderer.ts constants
const MAP_TILE_SIZE = 3
const MAP_ROOM_SIZE = MAP_TILE_SIZE * 50

// Render text canvas at this multiple of the world-space size so zooming stays crisp
const TEXT_RENDER_SCALE = 4

// All visual dimensions use scaleValue = value * (MAP_ROOM_SIZE / 50) = value * MAP_TILE_SIZE
// Positions: rx * MAP_ROOM_SIZE + x * MAP_TILE_SIZE  (x is tile coord 0-49 within room)
function mp(roomName: string, x: number, y: number): [number, number] | null {
  const coord = parseRoomName(roomName)
  if (!coord) return null
  return [
    coord.x * MAP_ROOM_SIZE + x * MAP_TILE_SIZE,
    coord.y * MAP_ROOM_SIZE + y * MAP_TILE_SIZE,
  ]
}

// Dash/gap sizes match @screeps/map reference: DASH=3/SCALE_ALPHA, DASH_GAP=2.5/SCALE_ALPHA
// In our space: 3 * MAP_TILE_SIZE and 2.5 * MAP_TILE_SIZE
const DASH_BASE = 3 * MAP_TILE_SIZE
const DASH_GAP_BASE = 2.5 * MAP_TILE_SIZE
const DOT_BASE = 1 * MAP_TILE_SIZE
const DOT_GAP_BASE = 2 * MAP_TILE_SIZE

function drawDashedPath(g: Graphics, pts: [number, number][], dashPx: number, gapPx: number): void {
  let drawing = true
  let remaining = dashPx
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const dx = x2 - x1
    const dy = y2 - y1
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (segLen < 0.001) continue
    const nx = dx / segLen
    const ny = dy / segLen
    let dist = 0
    while (dist < segLen) {
      const step = Math.min(remaining, segLen - dist)
      if (drawing) {
        const sx = x1 + nx * dist
        const sy = y1 + ny * dist
        g.moveTo(sx, sy)
        g.lineTo(sx + nx * step, sy + ny * step)
      }
      dist += step
      remaining -= step
      if (remaining < 0.001) {
        drawing = !drawing
        remaining = drawing ? dashPx : gapPx
      }
    }
  }
}

function circleToPath(cx: number, cy: number, r: number): [number, number][] {
  const segs = Math.max(32, Math.ceil((2 * Math.PI * r) / 2))
  const pts: [number, number][] = []
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * 2 * Math.PI
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

export class MapVisualLayer {
  readonly container: Container
  private readonly g: Graphics

  constructor() {
    this.container = new Container()
    this.container.label = 'mapVisuals'
    this.g = new Graphics()
    this.container.addChild(this.g)
  }

  update(raw: string): void {
    const children = this.container.removeChildren()
    for (const child of children) {
      if (child !== this.g) child.destroy()
    }
    this.g.clear()
    this.container.addChild(this.g)

    if (!raw) return

    const g = this.g
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      let entry: MapVisualEntry
      try { entry = JSON.parse(line) } catch { continue }

      const s = entry.s ?? {}
      const alpha = s.opacity ?? 0.5

      switch (entry.t) {
        case 'l': this.drawLine(g, entry, s, alpha); break
        case 'c': this.drawCircle(g, entry, s, alpha); break
        case 'r': this.drawRect(g, entry, s, alpha); break
        case 'p': this.drawPoly(g, entry, s, alpha); break
        case 't': this.drawText(entry, s, alpha); break
      }
    }
  }

  clear(): void {
    const children = this.container.removeChildren()
    for (const child of children) {
      if (child !== this.g) child.destroy()
    }
    this.g.clear()
    this.container.addChild(this.g)
  }

  private drawLine(g: Graphics, e: Extract<MapVisualEntry, {t:'l'}>, s: VisualStyle, alpha: number): void {
    const p1 = mp(e.n1, e.x1, e.y1)
    const p2 = mp(e.n2, e.x2, e.y2)
    if (!p1 || !p2) return
    const color = s.color ?? '#ffffff'
    const w = (s.width ?? 0.5) * MAP_TILE_SIZE

    if (s.lineStyle === 'dashed') {
      drawDashedPath(g, [p1, p2], DASH_BASE * (s.width ?? 0.5), DASH_GAP_BASE * (s.width ?? 0.5))
    } else if (s.lineStyle === 'dotted') {
      drawDashedPath(g, [p1, p2], DOT_BASE * (s.width ?? 0.5), DOT_GAP_BASE * (s.width ?? 0.5))
    } else {
      g.moveTo(p1[0], p1[1])
      g.lineTo(p2[0], p2[1])
    }
    g.stroke({ color, width: w, alpha })
  }

  private drawCircle(g: Graphics, e: Extract<MapVisualEntry, {t:'c'}>, s: VisualStyle, alpha: number): void {
    const pos = mp(e.n, e.x, e.y)
    if (!pos) return
    const [cx, cy] = pos
    const r = (s.radius ?? 10) * MAP_TILE_SIZE
    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    const sw = (s.strokeWidth ?? 0.5) * MAP_TILE_SIZE

    if (hasFill) {
      g.circle(cx, cy, r)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      if (s.lineStyle === 'dashed') {
        drawDashedPath(g, circleToPath(cx, cy, r), DASH_BASE * (s.strokeWidth ?? 0.5), DASH_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else if (s.lineStyle === 'dotted') {
        drawDashedPath(g, circleToPath(cx, cy, r), DOT_BASE * (s.strokeWidth ?? 0.5), DOT_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else {
        g.circle(cx, cy, r)
      }
      g.stroke({ color: s.stroke!, width: sw, alpha })
    }
  }

  private drawRect(g: Graphics, e: Extract<MapVisualEntry, {t:'r'}>, s: VisualStyle, alpha: number): void {
    const tl = mp(e.n, e.x, e.y)
    const tr = mp(e.n, e.x + e.w, e.y)
    const br = mp(e.n, e.x + e.w, e.y + e.h)
    const bl = mp(e.n, e.x, e.y + e.h)
    if (!tl || !tr || !br || !bl) return

    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    const corners: [number, number][] = [tl, tr, br, bl, tl]
    const flat = corners.flatMap(p => p)
    const sw = (s.strokeWidth ?? 0.5) * MAP_TILE_SIZE

    if (hasFill) {
      g.poly(flat.slice(0, 8), true)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      if (s.lineStyle === 'dashed') {
        drawDashedPath(g, corners, DASH_BASE * (s.strokeWidth ?? 0.5), DASH_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else if (s.lineStyle === 'dotted') {
        drawDashedPath(g, corners, DOT_BASE * (s.strokeWidth ?? 0.5), DOT_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else {
        g.poly(flat.slice(0, 8), true)
      }
      g.stroke({ color: s.stroke!, width: sw, alpha })
    }
  }

  private drawPoly(g: Graphics, e: Extract<MapVisualEntry, {t:'p'}>, s: VisualStyle, alpha: number): void {
    if (!e.points || e.points.length === 0) return
    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    if (!hasFill && !hasStroke) return

    const pxPts: [number, number][] = []
    for (const { n, x, y } of e.points) {
      const pos = mp(n, x, y)
      if (!pos) return
      pxPts.push(pos)
    }

    const flat = pxPts.flatMap(p => p)
    const sw = (s.strokeWidth ?? 0.5) * MAP_TILE_SIZE

    if (hasFill) {
      g.poly(flat, true)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      if (s.lineStyle === 'dashed') {
        const first = pxPts[0], last = pxPts[pxPts.length - 1]
        const closed = first[0] === last[0] && first[1] === last[1]
        drawDashedPath(g, closed ? pxPts : [...pxPts, first], DASH_BASE * (s.strokeWidth ?? 0.5), DASH_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else if (s.lineStyle === 'dotted') {
        const first = pxPts[0], last = pxPts[pxPts.length - 1]
        const closed = first[0] === last[0] && first[1] === last[1]
        drawDashedPath(g, closed ? pxPts : [...pxPts, first], DOT_BASE * (s.strokeWidth ?? 0.5), DOT_GAP_BASE * (s.strokeWidth ?? 0.5))
      } else {
        g.poly(flat, true)
      }
      g.stroke({ color: s.stroke!, width: sw, alpha })
    }
  }

  private drawText(e: Extract<MapVisualEntry, {t:'t'}>, s: VisualStyle, alpha: number): void {
    const pos = mp(e.n, e.x, e.y)
    if (!pos) return
    const [tx, ty] = pos

    // Map visuals use separate fontSize/fontFamily (not combined `font` field)
    const fontSizeTiles = s.fontSize ?? 10
    const fontFamily = s.fontFamily ?? 'sans-serif'
    const fontSize = fontSizeTiles * MAP_TILE_SIZE
    const align = s.align ?? 'center'

    // Render canvas at TEXT_RENDER_SCALE × world size, then scale the sprite back down.
    // This keeps glyph textures crisp when the camera is zoomed in.
    const style = new TextStyle({
      fill: s.color ?? '#ffffff',
      fontSize: fontSize * TEXT_RENDER_SCALE,
      fontFamily,
      align,
      ...(s.fontStyle ? { fontStyle: s.fontStyle as 'normal' | 'italic' | 'oblique' } : {}),
      ...(s.fontVariant ? { fontVariant: s.fontVariant as 'normal' | 'small-caps' } : {}),
      ...(s.stroke && s.strokeWidth
        ? { stroke: { color: s.stroke, width: s.strokeWidth * MAP_TILE_SIZE * TEXT_RENDER_SCALE } }
        : {}),
    })

    if (s.backgroundColor && s.backgroundColor !== 'transparent') {
      const pad = (s.backgroundPadding ?? 2) * MAP_TILE_SIZE
      const t = new Text({ text: e.text, style })
      t.scale.set(1 / TEXT_RENDER_SCALE)
      const mw = t.width
      const mh = t.height
      t.destroy()
      const ax = align === 'center' ? 0.5 : align === 'right' ? 1 : 0
      const bx = tx - ax * mw - pad
      const by = ty - mh / 2 - pad
      const bg = new Graphics()
      bg.rect(bx, by, mw + pad * 2, mh + pad * 2)
      bg.fill({ color: s.backgroundColor, alpha })
      this.container.addChild(bg)
    }

    const t = new Text({ text: e.text, style })
    t.scale.set(1 / TEXT_RENDER_SCALE)
    t.anchor.x = align === 'center' ? 0.5 : align === 'right' ? 1 : 0
    t.anchor.y = 0.5
    t.position.set(tx, ty)
    t.alpha = alpha
    this.container.addChild(t)
  }

  destroy(): void {
    const children = this.container.removeChildren()
    for (const child of children) {
      if (child !== this.g) child.destroy()
    }
    this.g.destroy()
    this.container.destroy()
  }
}
