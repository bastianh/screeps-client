import { Application, Container, Point } from 'pixi.js'

export const TILE_SIZE = 12
export const ROOM_SIZE = 50 * TILE_SIZE
const PADDING = 48
const OVERSCROLL = 128

export class RoomRenderer {
  readonly app: Application
  readonly world: Container
  private destroyed = false
  private canDrag = false
  private container: HTMLElement
  private resizeObserver: ResizeObserver | null = null
  private bounceRaf: number | null = null
  private wheelTimeout: number | null = null

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

  private clampView(extended = false): void {
    const scale = this.world.scale.x
    const scaledSize = ROOM_SIZE * scale
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight
    const extra = extended ? OVERSCROLL : 0

    // Horizontal: keep at least PADDING visible around the room
    if (scaledSize <= cw) {
      this.world.x = cw / 2 - scaledSize / 2
    } else {
      const minX = cw - scaledSize - PADDING - extra
      const maxX = PADDING + extra
      this.world.x = Math.min(maxX, Math.max(minX, this.world.x))
    }

    // Vertical: keep at least PADDING visible around the room
    if (scaledSize <= ch) {
      this.world.y = ch / 2 - scaledSize / 2
    } else {
      const minY = ch - scaledSize - PADDING - extra
      const maxY = PADDING + extra
      this.world.y = Math.min(maxY, Math.max(minY, this.world.y))
    }

    // Drag is allowed if at least one dimension exceeds the viewport
    this.canDrag = scaledSize > cw || scaledSize > ch
  }

  private getTargetPosition(): { x: number; y: number } | null {
    const scale = this.world.scale.x
    const scaledSize = ROOM_SIZE * scale
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight

    let targetX: number | null = null
    let targetY: number | null = null

    // Horizontal: spring back to PADDING boundary
    if (scaledSize <= cw) {
      targetX = cw / 2 - scaledSize / 2
    } else {
      const minX = cw - scaledSize - PADDING
      const maxX = PADDING
      if (this.world.x < minX) targetX = minX
      else if (this.world.x > maxX) targetX = maxX
    }

    // Vertical: spring back to PADDING boundary
    if (scaledSize <= ch) {
      targetY = ch / 2 - scaledSize / 2
    } else {
      const minY = ch - scaledSize - PADDING
      const maxY = PADDING
      if (this.world.y < minY) targetY = minY
      else if (this.world.y > maxY) targetY = maxY
    }

    if (targetX === null && targetY === null) return null
    return { x: targetX ?? this.world.x, y: targetY ?? this.world.y }
  }

  private springBack(): void {
    const targetPos = this.getTargetPosition()
    const targetScale = this.getTargetScale()

    if (!targetPos && targetScale === null) return

    const startX = this.world.x
    const startY = this.world.y
    const startScale = this.world.scale.x
    const startTime = performance.now()
    const duration = 300

    // For scale bounce, always use viewport center to avoid drift
    const viewportCenterX = this.container.clientWidth / 2
    const viewportCenterY = this.container.clientHeight / 2
    const worldCenterX = (viewportCenterX - startX) / startScale
    const worldCenterY = (viewportCenterY - startY) / startScale

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - t, 3)

      if (targetScale !== null) {
        const currentScale = startScale + (targetScale - startScale) * ease
        this.world.scale.set(currentScale)
        this.world.x = viewportCenterX - worldCenterX * currentScale
        this.world.y = viewportCenterY - worldCenterY * currentScale
      }

      if (targetPos && targetScale === null) {
        this.world.x = startX + (targetPos.x - startX) * ease
        this.world.y = startY + (targetPos.y - startY) * ease
      }

      if (t < 1) {
        this.bounceRaf = requestAnimationFrame(animate)
      } else {
        this.bounceRaf = null
        this.clampView()
      }
    }

    this.cancelBounce()
    this.bounceRaf = requestAnimationFrame(animate)
  }

  private cancelBounce(): void {
    if (this.bounceRaf !== null) {
      cancelAnimationFrame(this.bounceRaf)
      this.bounceRaf = null
    }
  }

  private cancelWheelTimeout(): void {
    if (this.wheelTimeout !== null) {
      clearTimeout(this.wheelTimeout)
      this.wheelTimeout = null
    }
  }

  private getTargetScale(): number | null {
    const minScale = this.getMinScale()
    const maxScale = 5
    if (this.world.scale.x < minScale) return minScale
    if (this.world.scale.x > maxScale) return maxScale
    return null
  }

  private setupCamera(): void {
    let dragging = false
    let lastPos = new Point(0, 0)
    const canvas = this.app.canvas

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.canDrag) return
      this.cancelBounce()
      this.cancelWheelTimeout()
      this.springBack()
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
      this.clampView(true)
    })

    const onUp = (e: PointerEvent) => {
      dragging = false
      canvas.releasePointerCapture(e.pointerId)
      this.springBack()
    }
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
      const minScale = this.getMinScale()
      const maxScale = 5
      let newScale = this.world.scale.x * scaleFactor

      // Rubber-band resistance: the further past the limit, the less effect
      const ZOOM_RESISTANCE = 0.6
      if (newScale < minScale) {
        newScale = minScale + (newScale - minScale) * ZOOM_RESISTANCE
      }
      if (newScale > maxScale) {
        newScale = maxScale + (newScale - maxScale) * ZOOM_RESISTANCE
      }

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      this.cancelBounce()

      if (newScale < minScale) {
        // Overzoom: zoom around viewport center so the room shrinks in place
        const viewportCenterX = this.container.clientWidth / 2
        const viewportCenterY = this.container.clientHeight / 2
        const worldCenterX = (viewportCenterX - this.world.x) / this.world.scale.x
        const worldCenterY = (viewportCenterY - this.world.y) / this.world.scale.y
        this.world.scale.set(newScale)
        this.world.x = viewportCenterX - worldCenterX * newScale
        this.world.y = viewportCenterY - worldCenterY * newScale
      } else {
        // Normal zoom: zoom around mouse pointer
        const worldX = (mouseX - this.world.x) / this.world.scale.x
        const worldY = (mouseY - this.world.y) / this.world.scale.y
        this.world.scale.set(newScale)
        this.world.x = mouseX - worldX * newScale
        this.world.y = mouseY - worldY * newScale
      }


      this.clampView()

      // Debounced spring back after zoom settles
      this.cancelWheelTimeout()
      this.wheelTimeout = window.setTimeout(() => {
        this.wheelTimeout = null
        this.springBack()
      }, 80)
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
    this.cancelBounce()
    this.cancelWheelTimeout()
    this.clampView()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelBounce()
    this.cancelWheelTimeout()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.app.destroy(true, { children: true })
  }
}
