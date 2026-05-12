import { Application, Container, Point } from 'pixi.js'

export const TILE_SIZE = 12
export const ROOM_SIZE = 50 * TILE_SIZE

export class RoomRenderer {
  readonly app: Application
  readonly world: Container
  private destroyed = false
  private canDrag = false
  private container: HTMLElement
  private resizeObserver: ResizeObserver | null = null

  private constructor(app: Application, container: HTMLElement) {
    this.app = app
    this.container = container
    this.world = new Container()
    this.app.stage.addChild(this.world)
    this.setupCamera()
    this.centerView()
    this.clampView()
    this.setupResizeObserver()
  }

  static async create(container: HTMLElement): Promise<RoomRenderer> {
    const app = new Application()
    await app.init({
      background: '#0d1117',
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    container.appendChild(app.canvas)
    return new RoomRenderer(app, container)
  }

  private getMinScale(): number {
    const padding = 64 // 32px on each side
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight
    return Math.min(cw, ch) / (ROOM_SIZE + padding)
  }

  private clampView(): void {
    const scale = this.world.scale.x
    const scaledSize = ROOM_SIZE * scale
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight

    // Horizontal
    if (scaledSize <= cw) {
      this.world.x = cw / 2 - scaledSize / 2
    } else {
      const minX = cw - scaledSize
      this.world.x = Math.min(0, Math.max(minX, this.world.x))
    }

    // Vertical
    if (scaledSize <= ch) {
      this.world.y = ch / 2 - scaledSize / 2
    } else {
      const minY = ch - scaledSize
      this.world.y = Math.min(0, Math.max(minY, this.world.y))
    }

    // Drag is allowed if at least one dimension exceeds the viewport
    this.canDrag = scaledSize > cw || scaledSize > ch
  }

  private setupCamera(): void {
    let dragging = false
    let lastPos = new Point(0, 0)
    const canvas = this.app.canvas

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.canDrag) return
      dragging = true
      lastPos = new Point(e.clientX, e.clientY)
      canvas.setPointerCapture(e.pointerId)
    })

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || !this.canDrag) return
      const dx = e.clientX - lastPos.x
      const dy = e.clientY - lastPos.y
      this.world.x += dx
      this.world.y += dy
      lastPos = new Point(e.clientX, e.clientY)
      this.clampView()
    })

    const onUp = (e: PointerEvent) => {
      dragging = false
      canvas.releasePointerCapture(e.pointerId)
    }
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
      const minScale = this.getMinScale()
      const newScale = Math.max(minScale, Math.min(5, this.world.scale.x * scaleFactor))

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const worldX = (mouseX - this.world.x) / this.world.scale.x
      const worldY = (mouseY - this.world.y) / this.world.scale.y

      this.world.scale.set(newScale)
      this.world.x = mouseX - worldX * newScale
      this.world.y = mouseY - worldY * newScale

      this.clampView()
    }, { passive: false })
  }

  private centerView(): void {
    const cx = this.container.clientWidth / 2
    const cy = this.container.clientHeight / 2
    const scale = this.world.scale.x
    this.world.x = cx - (ROOM_SIZE * scale) / 2
    this.world.y = cy - (ROOM_SIZE * scale) / 2
  }

  private setupResizeObserver(): void {
    // Initial sizing
    const { width, height } = this.container.getBoundingClientRect()
    this.app.renderer.resize(width, height)

    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      this.app.renderer.resize(width, height)
      this.clampView()
    })
    this.resizeObserver.observe(this.container)
  }

  clear(): void {
    this.world.removeChildren()
    this.world.scale.set(1)
    this.clampView()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.app.destroy(true, { children: true })
  }
}
