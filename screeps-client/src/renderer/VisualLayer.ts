import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { TILE_SIZE } from './RoomRenderer.js'
import type { RoomVisualEntry, VisualStyle } from 'screeps-connectivity'

// RoomVisual tile coords → pixel: tile (x,y) center aligns with ObjectLayer's TILE_SIZE/2 offset
const tp = (c: number) => (c + 0.5) * TILE_SIZE

// Render text at 4× then scale down for crisp glyphs at small tile sizes
const TEXT_SCALE = 4

// Dash/gap sizes in pixels for each lineStyle
const DASH_PX: Record<string, [number, number]> = {
  dashed: [0.4 * TILE_SIZE, 0.4 * TILE_SIZE],
  dotted: [0.1 * TILE_SIZE, 0.3 * TILE_SIZE],
}

// Draw a dashed/dotted path along a sequence of [px, py] points.
// All resulting moveTo/lineTo calls are batched; caller must call g.stroke() afterwards.
function drawDashedPath(
  g: Graphics,
  pts: [number, number][],
  dashPx: number,
  gapPx: number,
): void {
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

// Approximate a circle as a closed polyline for dashed stroke rendering
function circleToPath(cx: number, cy: number, r: number): [number, number][] {
  const segs = Math.max(32, Math.ceil((2 * Math.PI * r) / 2))
  const pts: [number, number][] = []
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * 2 * Math.PI
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts // first === last, so drawDashedPath handles it as a closed loop
}

function parseFontSize(font: string | number | undefined): number {
  if (font == null) return 0.7
  if (typeof font === 'number') return font
  const m = font.match(/^([0-9.]+)(px)?/)
  if (!m) return 0.7
  const size = parseFloat(m[1])
  return m[2] ? size / TILE_SIZE : size
}

function parseFontFamily(font: string | number | undefined): string {
  if (typeof font !== 'string') return 'Arial'
  const m = font.match(/^[0-9.]+(px)?\s+(.+)$/)
  return m ? m[2] : 'Arial'
}

export class VisualLayer {
  readonly container: Container
  private readonly g: Graphics

  constructor() {
    this.container = new Container()
    this.container.label = 'visuals'
    this.g = new Graphics()
    this.container.addChild(this.g)
  }

  update(raw: string): void {
    // Destroy Text/background Graphics children from the previous tick to free their textures.
    // The persistent Graphics (this.g) is kept and reused.
    const children = this.container.removeChildren()
    for (const child of children) {
      if (child !== this.g) child.destroy()
    }
    this.g.clear()
    this.container.addChild(this.g)

    if (!raw) return

    const g = this.g

    // Performance optimization: Bulk parse JSON array if possible.
    // Calling JSON.parse once on a reconstructed array is significantly faster
    // than calling it per-line inside a loop due to less JS/C++ boundary overhead.
    let entries: RoomVisualEntry[] = []
    const safeRaw = raw.trim()
    if (safeRaw) {
      try {
        const jsonStr = '[' + safeRaw.split('\n').filter(l => l.trim()).join(',') + ']'
        entries = JSON.parse(jsonStr)
      } catch {
        // Fallback: If there are invalid lines that break bulk parsing, fallback to slow line-by-line parsing
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue
          try { entries.push(JSON.parse(line)) } catch { continue }
        }
      }
    }

    for (const entry of entries) {
      const s = entry.s ?? {}
      const alpha = s.opacity ?? 1

      switch (entry.t) {
        case 'l': this.drawLine(g, entry, s, alpha); break
        case 'c': this.drawCircle(g, entry, s, alpha); break
        case 'r': this.drawRect(g, entry, s, alpha); break
        case 'p': this.drawPoly(g, entry, s, alpha); break
        case 't': this.drawText(entry, s, alpha); break
      }
    }
  }

  private drawLine(g: Graphics, e: Extract<RoomVisualEntry, {t:'l'}>, s: VisualStyle, alpha: number): void {
    const x1 = tp(e.x1), y1 = tp(e.y1), x2 = tp(e.x2), y2 = tp(e.y2)
    const color = s.color ?? '#ffffff'
    const width = (s.width ?? 0.1) * TILE_SIZE

    if (s.lineStyle && s.lineStyle !== 'solid') {
      const [dash, gap] = DASH_PX[s.lineStyle]
      drawDashedPath(g, [[x1, y1], [x2, y2]], dash, gap)
    } else {
      g.moveTo(x1, y1)
      g.lineTo(x2, y2)
    }
    g.stroke({ color, width, alpha })
  }

  private drawCircle(g: Graphics, e: Extract<RoomVisualEntry, {t:'c'}>, s: VisualStyle, alpha: number): void {
    const cx = tp(e.x)
    const cy = tp(e.y)
    const r = (s.radius ?? 0.5) * TILE_SIZE
    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    const dashed = s.lineStyle && s.lineStyle !== 'solid'

    if (hasFill) {
      g.circle(cx, cy, r)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      const strokeWidth = s.strokeWidth! * TILE_SIZE
      if (dashed) {
        const [dash, gap] = DASH_PX[s.lineStyle!]
        drawDashedPath(g, circleToPath(cx, cy, r), dash, gap)
      } else {
        g.circle(cx, cy, r)
      }
      g.stroke({ color: s.stroke!, width: strokeWidth, alpha })
    }
  }

  private drawRect(g: Graphics, e: Extract<RoomVisualEntry, {t:'r'}>, s: VisualStyle, alpha: number): void {
    const px = tp(e.x)
    const py = tp(e.y)
    const w = e.w * TILE_SIZE
    const h = e.h * TILE_SIZE
    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    const dashed = s.lineStyle && s.lineStyle !== 'solid'

    if (hasFill) {
      g.rect(px, py, w, h)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      const strokeWidth = s.strokeWidth! * TILE_SIZE
      if (dashed) {
        const [dash, gap] = DASH_PX[s.lineStyle!]
        const corners: [number, number][] = [
          [px, py], [px + w, py], [px + w, py + h], [px, py + h], [px, py],
        ]
        drawDashedPath(g, corners, dash, gap)
      } else {
        g.rect(px, py, w, h)
      }
      g.stroke({ color: s.stroke!, width: strokeWidth, alpha })
    }
  }

  private drawPoly(g: Graphics, e: Extract<RoomVisualEntry, {t:'p'}>, s: VisualStyle, alpha: number): void {
    if (!e.points || e.points.length === 0) return

    const hasFill = !!(s.fill && s.fill !== 'transparent')
    const hasStroke = !!(s.stroke && s.strokeWidth)
    if (!hasFill && !hasStroke) return

    const dashed = s.lineStyle && s.lineStyle !== 'solid'

    // Performance optimization: avoid intermediate arrays by mapping directly to a flat array
    // Only construct the array of point pairs if needed for dashed paths
    const flatPxPts = new Array(e.points.length * 2)
    let pxPts: [number, number][] | undefined

    if (hasStroke && dashed) {
      pxPts = new Array(e.points.length)
    }

    for (let i = 0; i < e.points.length; i++) {
      const [x, y] = e.points[i]
      const px = tp(x)
      const py = tp(y)
      flatPxPts[i * 2] = px
      flatPxPts[i * 2 + 1] = py
      if (pxPts) {
        pxPts[i] = [px, py]
      }
    }

    if (hasFill) {
      g.poly(flatPxPts, true)
      g.fill({ color: s.fill!, alpha })
    }
    if (hasStroke) {
      const strokeWidth = s.strokeWidth! * TILE_SIZE
      if (dashed && pxPts) {
        const [dash, gap] = DASH_PX[s.lineStyle!]
        // Ensure path is closed for stroke
        const first = pxPts[0]
        const last = pxPts[pxPts.length - 1]
        const closed = first[0] === last[0] && first[1] === last[1]
        drawDashedPath(g, closed ? pxPts : [...pxPts, first], dash, gap)
      } else {
        g.poly(flatPxPts, true)
      }
      g.stroke({ color: s.stroke!, width: strokeWidth, alpha })
    }
  }

  private drawText(e: Extract<RoomVisualEntry, {t:'t'}>, s: VisualStyle, alpha: number): void {
    const tileFontSize = parseFontSize(s.font)
    const fontFamily = parseFontFamily(s.font)
    const align = s.align ?? 'left'

    const style = new TextStyle({
      fill: s.color ?? '#ffffff',
      fontSize: Math.round(tileFontSize * TILE_SIZE * TEXT_SCALE),
      fontFamily,
      align,
      ...(s.stroke && s.strokeWidth
        ? { stroke: { color: s.stroke, width: s.strokeWidth * TILE_SIZE * TEXT_SCALE } }
        : {}),
    })

    // Background rectangle behind text
    if (s.backgroundColor && s.backgroundColor !== 'transparent') {
      const metrics = CanvasTextMetrics.measureText(e.text, style)
      const mw = metrics.width / TEXT_SCALE
      const mh = metrics.height / TEXT_SCALE
      const pad = (s.backgroundPadding ?? 0.3) * TILE_SIZE
      const ax = align === 'center' ? 0.5 : align === 'right' ? 1 : 0
      const bx = tp(e.x) - ax * mw - pad
      const by = tp(e.y) - mh / 2 - pad
      const bg = new Graphics()
      bg.rect(bx, by, mw + pad * 2, mh + pad * 2)
      bg.fill({ color: s.backgroundColor, alpha })
      this.container.addChild(bg)
    }

    const t = new Text({ text: e.text, style })
    t.scale.set(1 / TEXT_SCALE)
    t.anchor.x = align === 'center' ? 0.5 : align === 'right' ? 1 : 0
    t.anchor.y = 0.5
    t.position.set(tp(e.x), tp(e.y))
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
