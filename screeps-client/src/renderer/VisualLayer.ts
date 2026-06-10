import { Container, Sprite, Texture, Ticker } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { ROOM_SIZE, TILE_SIZE } from './RoomRenderer.js'
import type { RoomVisualEntry, VisualStyle } from 'screeps-connectivity'

// RoomVisual tile coords → pixel: tile (x,y) center aligns with ObjectLayer's TILE_SIZE/2 offset
const tp = (c: number) => (c + 0.5) * TILE_SIZE

const DASH_PX: Record<string, [number, number]> = {
  dashed: [0.3 * TILE_SIZE, 0.25 * TILE_SIZE],
  dotted: [0.1 * TILE_SIZE, 0.2 * TILE_SIZE],
}

// Cap canvas RAM/GPU at ~23 MB (2400² × 4 bytes).
const MAX_CANVAS_PX = 2400

function parseFontSize(font: string | number | undefined): number {
  if (font == null) return 0.7
  if (typeof font === 'number') return font
  const m = font.match(/^([0-9.]+)(px)?/)
  if (!m) return 0.7
  const size = parseFloat(m[1])
  return m[2] ? size / TILE_SIZE : size
}

function parseFontFamily(font: string | number | undefined): string {
  if (typeof font !== 'string') return 'sans-serif'
  const m = font.match(/^[0-9.]+(px)?\s+(.+)$/)
  return m ? m[2] : 'sans-serif'
}

// Draws all visuals onto a 2D canvas each tick (same approach as the original Angular client).
// Canvas size = world.scale × renderer.resolution × ROOM_SIZE so there is always a 1:1 physical
// pixel mapping between canvas and screen — no GPU upsampling or downsampling, no blur at any zoom.
// The canvas is wrapped in a PixiJS texture/sprite that lives in the scene graph so pan/zoom is
// inherited automatically. The ticker watches for zoom changes and resizes + redraws as needed.
export class VisualLayer {
  readonly container: Container
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private texture: Texture
  private readonly sprite: Sprite
  private readonly resolution: number
  private readonly world: Container
  private readonly ticker: Ticker
  private lastRaw = ''
  private lastPhysSize = 0
  private prevScaleX = -1   // for detecting zoom-settled (scale unchanged for 1 frame)

  constructor(renderer: Renderer, world: Container, ticker: Ticker) {
    this.resolution = renderer.resolution
    this.world = world
    this.ticker = ticker

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!

    // skipCache: true so every Texture.from call creates an independent TextureSource.
    // This means destroying an old texture never nulls out a newer one sharing the same source.
    const physSize = this.idealPhysSize()
    this.canvas.width = physSize
    this.canvas.height = physSize
    this.texture = Texture.from(this.canvas, true)
    this.lastPhysSize = physSize

    this.sprite = new Sprite(this.texture)
    this.sprite.scale.set(ROOM_SIZE / physSize)

    this.container = new Container()
    this.container.label = 'visuals'
    this.container.addChild(this.sprite)

    this.ticker.add(this.onTick, this)
  }

  // canvas px = world.scale × devicePixelRatio × ROOM_SIZE, capped to avoid huge allocations.
  private idealPhysSize(): number {
    return Math.min(Math.ceil(this.world.scale.x * this.resolution * ROOM_SIZE), MAX_CANVAS_PX)
  }

  private onTick = (): void => {
    const scaleX = this.world.scale.x
    const physSize = this.idealPhysSize()
    // Only resize+redraw once zoom settles (scale stable for one frame), not on every zoom frame.
    if (scaleX === this.prevScaleX && physSize !== this.lastPhysSize && this.lastRaw) {
      this.resizeTo(physSize)
      this.redraw()
    }
    this.prevScaleX = scaleX
  }

  update(raw: string): void {
    this.lastRaw = raw
    const physSize = this.idealPhysSize()
    if (physSize !== this.lastPhysSize) this.resizeTo(physSize)
    this.redraw()
  }

  private resizeTo(physSize: number): void {
    this.canvas.width = physSize
    this.canvas.height = physSize

    const oldTexture = this.texture
    // skipCache: true → new independent TextureSource; safe to destroy old one below.
    this.texture = Texture.from(this.canvas, true)
    this.sprite.texture = this.texture
    this.sprite.scale.set(ROOM_SIZE / physSize)

    oldTexture.destroy(true)   // old source is independent — safe to destroy
    this.lastPhysSize = physSize
  }

  private redraw(): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!this.lastRaw) {
      this.sprite.visible = false
      this.texture.source.update()
      return
    }

    const drawScale = canvas.width / ROOM_SIZE
    ctx.save()
    ctx.scale(drawScale, drawScale)

    for (const line of this.lastRaw.split('\n')) {
      if (!line.trim()) continue
      let entry: RoomVisualEntry
      try { entry = JSON.parse(line) } catch { continue }

      const s = entry.s ?? {}
      const alpha = s.opacity ?? 1

      switch (entry.t) {
        case 'l': this.drawLine(entry, s, alpha); break
        case 'c': this.drawCircle(entry, s, alpha); break
        case 'r': this.drawRect(entry, s, alpha); break
        case 'p': this.drawPoly(entry, s, alpha); break
        case 't': this.drawText(entry, s, alpha); break
      }
    }

    ctx.restore()
    this.texture.source.update()
    this.sprite.visible = true
  }

  private drawLine(e: Extract<RoomVisualEntry, {t:'l'}>, s: VisualStyle, alpha: number): void {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = s.color ?? '#ffffff'
    ctx.lineWidth = (s.width ?? 0.1) * TILE_SIZE
    ctx.setLineDash(s.lineStyle === 'dotted' ? DASH_PX.dotted : s.lineStyle === 'dashed' ? DASH_PX.dashed : [])
    ctx.beginPath()
    ctx.moveTo(tp(e.x1), tp(e.y1))
    ctx.lineTo(tp(e.x2), tp(e.y2))
    ctx.stroke()
    ctx.restore()
  }

  private drawCircle(e: Extract<RoomVisualEntry, {t:'c'}>, s: VisualStyle, alpha: number): void {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.setLineDash(s.lineStyle === 'dotted' ? DASH_PX.dotted : s.lineStyle === 'dashed' ? DASH_PX.dashed : [])
    ctx.beginPath()
    ctx.arc(tp(e.x), tp(e.y), (s.radius ?? 0.5) * TILE_SIZE, 0, 2 * Math.PI)
    if (s.fill && s.fill !== 'transparent') { ctx.fillStyle = s.fill; ctx.fill() }
    if (s.stroke && s.strokeWidth) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth * TILE_SIZE; ctx.stroke() }
    ctx.restore()
  }

  private drawRect(e: Extract<RoomVisualEntry, {t:'r'}>, s: VisualStyle, alpha: number): void {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.setLineDash(s.lineStyle === 'dotted' ? DASH_PX.dotted : s.lineStyle === 'dashed' ? DASH_PX.dashed : [])
    ctx.beginPath()
    ctx.rect(tp(e.x), tp(e.y), e.w * TILE_SIZE, e.h * TILE_SIZE)
    if (s.fill && s.fill !== 'transparent') { ctx.fillStyle = s.fill; ctx.fill() }
    if (s.stroke && s.strokeWidth) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth * TILE_SIZE; ctx.stroke() }
    ctx.restore()
  }

  private drawPoly(e: Extract<RoomVisualEntry, {t:'p'}>, s: VisualStyle, alpha: number): void {
    if (!e.points?.length) return
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.setLineDash(s.lineStyle === 'dotted' ? DASH_PX.dotted : s.lineStyle === 'dashed' ? DASH_PX.dashed : [])
    ctx.beginPath()
    ctx.moveTo(tp(e.points[0][0]), tp(e.points[0][1]))
    for (let i = 1; i < e.points.length; i++) ctx.lineTo(tp(e.points[i][0]), tp(e.points[i][1]))
    if (s.fill && s.fill !== 'transparent') { ctx.fillStyle = s.fill; ctx.fill() }
    if (s.stroke && s.strokeWidth) { ctx.closePath(); ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth * TILE_SIZE; ctx.stroke() }
    ctx.restore()
  }

  private drawText(e: Extract<RoomVisualEntry, {t:'t'}>, s: VisualStyle, alpha: number): void {
    const { ctx } = this
    const fontSize = parseFontSize(s.font) * TILE_SIZE
    const fontFamily = parseFontFamily(s.font)
    const align = (s.align ?? 'left') as CanvasTextAlign
    const x = tp(e.x), y = tp(e.y)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'

    if (s.backgroundColor && s.backgroundColor !== 'transparent') {
      const tw = ctx.measureText(e.text).width
      const pad = (s.backgroundPadding ?? 0.3) * TILE_SIZE
      const ax = align === 'center' ? 0.5 : align === 'right' ? 1 : 0
      ctx.fillStyle = s.backgroundColor
      ctx.fillRect(x - ax * tw - pad, y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2)
    }

    ctx.fillStyle = s.color ?? '#ffffff'
    if (s.stroke && s.strokeWidth) {
      ctx.strokeStyle = s.stroke
      ctx.lineWidth = s.strokeWidth * TILE_SIZE
      ctx.lineJoin = 'round'
      ctx.strokeText(e.text, x, y)
    }
    ctx.fillText(e.text, x, y)
    ctx.restore()
  }

  destroy(): void {
    this.ticker.remove(this.onTick, this)
    this.texture.destroy(true)
    this.container.destroy({ children: true })
  }
}
