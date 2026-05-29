import { Application, Container, Graphics, Point, Rectangle } from 'pixi.js'
import { HoverHighlightLayer } from './HoverHighlightLayer.js'

export const TILE_SIZE = 12
export const ROOM_SIZE = 50 * TILE_SIZE
const PADDING = 48
const OVERSCROLL = 128

export class RoomRenderer {
  readonly app: Application
  readonly world: Container
  readonly hoverLayer: HoverHighlightLayer
  private destroyed = false
  private canDrag = false
  private container: HTMLElement
  private resizeObserver: ResizeObserver | null = null
  private bounceRaf: number | null = null
  private wheelTimeout: number | null = null
  private navOverlay: Container
  private lastMouseX = 0
  private lastMouseY = 0

  private onHoverTile: ((tx: number | null, ty: number | null) => void) | null = null
  private onClickTile: ((tx: number, ty: number, ctrlKey: boolean) => void) | null = null
  private onRightClick: (() => void) | null = null

  private constructor(app: Application, container: HTMLElement) {
    this.app = app
    this.container = container
    this.world = new Container()
    this.app.stage.addChild(this.world)
    this.hoverLayer = new HoverHighlightLayer(app.ticker)
    this.world.addChild(this.hoverLayer.container)
    this.navOverlay = new Container()
    this.world.addChild(this.navOverlay)
    this.setupCamera()
    this.centerView()
    this.clampView()
    this.setupResizeObserver()
  }

  bringNavOverlayToTop(): void {
    // Keep hover layer just below nav overlay
    if (this.hoverLayer.container.parent === this.world) {
      this.world.removeChild(this.hoverLayer.container)
      this.world.addChild(this.hoverLayer.container)
    }
    if (this.navOverlay.parent === this.world) {
      this.world.removeChild(this.navOverlay)
      this.world.addChild(this.navOverlay)
    }
  }

  static async create(container: HTMLElement): Promise<RoomRenderer> {
    const app = new Application()
    await app.init({
      background: '#0d1117',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    container.appendChild(app.canvas)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).__PIXI_APP__ = app
    }
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

    // Horizontal
    if (scaledSize <= cw) {
      const centerX = cw / 2 - scaledSize / 2
      if (extended) {
        this.world.x = Math.min(centerX + OVERSCROLL, Math.max(centerX - OVERSCROLL, this.world.x))
      } else {
        this.world.x = centerX
      }
    } else {
      const minX = cw - scaledSize - PADDING - extra
      const maxX = PADDING + extra
      this.world.x = Math.min(maxX, Math.max(minX, this.world.x))
    }

    // Vertical
    if (scaledSize <= ch) {
      const centerY = ch / 2 - scaledSize / 2
      if (extended) {
        this.world.y = Math.min(centerY + OVERSCROLL, Math.max(centerY - OVERSCROLL, this.world.y))
      } else {
        this.world.y = centerY
      }
    } else {
      const minY = ch - scaledSize - PADDING - extra
      const maxY = PADDING + extra
      this.world.y = Math.min(maxY, Math.max(minY, this.world.y))
    }

    this.canDrag = true
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
    let pointerDownPos = new Point(0, 0)
    const canvas = this.app.canvas as HTMLCanvasElement
    const CLICK_THRESHOLD = 4

    canvas.style.touchAction = 'none'
    canvas.style.userSelect = 'none'

    const activePointers = new Map<number, { x: number; y: number }>()
    let pinching = false
    let pinchPivotWorldX = 0
    let pinchPivotWorldY = 0
    let pinchStartDist = 0
    let pinchStartScale = 0


    canvas.addEventListener('pointerdown', (e) => {
      this.cancelBounce()
      this.cancelWheelTimeout()
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.setPointerCapture(e.pointerId)

      if (activePointers.size >= 2) {
        // Enter pinch mode, cancel single-finger drag
        dragging = false
        pinching = true
        const pts = [...activePointers.values()]
        const rect = canvas.getBoundingClientRect()
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top
        pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        pinchStartScale = this.world.scale.x
        pinchPivotWorldX = (midX - this.world.x) / pinchStartScale
        pinchPivotWorldY = (midY - this.world.y) / pinchStartScale
      } else {
        pinching = false
        dragging = this.canDrag
        lastPos = new Point(e.clientX, e.clientY)
        pointerDownPos = new Point(e.clientX, e.clientY)
      }
    })

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect()
      this.lastMouseX = e.clientX - rect.left
      this.lastMouseY = e.clientY - rect.top

      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }

      if (pinching && activePointers.size === 2) {
        const pts = [...activePointers.values()]
        const newMidX = (pts[0].x + pts[1].x) / 2 - rect.left
        const newMidY = (pts[0].y + pts[1].y) / 2 - rect.top
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        const minScale = this.getMinScale()
        const maxScale = 5
        const ZOOM_RESISTANCE = 0.6
        let newScale = pinchStartScale * (newDist / pinchStartDist)
        if (newScale < minScale) newScale = minScale + (newScale - minScale) * ZOOM_RESISTANCE
        if (newScale > maxScale) newScale = maxScale + (newScale - maxScale) * ZOOM_RESISTANCE
        this.cancelBounce()
        this.world.scale.set(newScale)
        this.world.x = newMidX - pinchPivotWorldX * newScale
        this.world.y = newMidY - pinchPivotWorldY * newScale
        this.clampView(true)
        return
      }

      // Update hover highlight when not pinching
      if (!pinching) {
        const tile = this.screenToTile(this.lastMouseX, this.lastMouseY)
        this.hoverLayer.setHoveredTile(tile?.tx ?? null, tile?.ty ?? null)
        this.onHoverTile?.(tile?.tx ?? null, tile?.ty ?? null)
      }

      if (!dragging || !this.canDrag) return
      const dx = e.clientX - lastPos.x
      const dy = e.clientY - lastPos.y
      this.world.x += dx
      this.world.y += dy
      lastPos = new Point(e.clientX, e.clientY)
      this.clampView(true)
    })

    const onUp = (e: PointerEvent) => {
      canvas.releasePointerCapture(e.pointerId)
      activePointers.delete(e.pointerId)

      if (pinching) {
        if (activePointers.size < 2) {
          pinching = false
          dragging = false
          this.springBack()
        }
        return
      }

      dragging = false

      // Treat as click if pointer barely moved
      const dx = e.clientX - pointerDownPos.x
      const dy = e.clientY - pointerDownPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < CLICK_THRESHOLD) {
        const rect = canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const tile = this.screenToTile(sx, sy)
        if (tile) this.onClickTile?.(tile.tx, tile.ty, e.ctrlKey || e.metaKey)
      }

      this.springBack()
    }
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      // button === 0 means Ctrl+Click on macOS — treat that as a regular click, not right-click
      if (e.button === 2) this.onRightClick?.()
    })

    canvas.addEventListener('pointerleave', () => {
      this.hoverLayer.setHoveredTile(null, null)
      this.onHoverTile?.(null, null)
    })

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

  /** Register callbacks for hover, click, and right-click tile events. */
  setTileHandlers(
    onHover: (tx: number | null, ty: number | null) => void,
    onClick: (tx: number, ty: number, ctrlKey: boolean) => void,
    onRightClick?: () => void,
  ): void {
    this.onHoverTile = onHover
    this.onClickTile = onClick
    this.onRightClick = onRightClick ?? null
  }

  /**
   * Convert screen (canvas-relative) coordinates to tile [0..49] coords.
   * Returns null if outside the room bounds.
   */
  private screenToTile(screenX: number, screenY: number): { tx: number; ty: number } | null {
    const worldX = (screenX - this.world.x) / this.world.scale.x
    const worldY = (screenY - this.world.y) / this.world.scale.y
    const tx = Math.floor(worldX / TILE_SIZE)
    const ty = Math.floor(worldY / TILE_SIZE)
    if (tx < 0 || tx >= 50 || ty < 0 || ty >= 50) return null
    return { tx, ty }
  }

  private centerView(): void {
    const cx = this.container.clientWidth / 2
    const cy = this.container.clientHeight / 2
    const scale = this.world.scale.x
    this.world.x = cx - (ROOM_SIZE * scale) / 2
    this.world.y = cy - (ROOM_SIZE * scale) / 2
  }

  resetView(): void {
    this.cancelBounce()
    this.cancelWheelTimeout()
    this.world.scale.set(this.getMinScale())
    this.centerView()
    this.clampView()
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

  setupNavigationZones(handlers: {
    west?: () => void
    east?: () => void
    north?: () => void
    south?: () => void
  }): void {
    // Remove existing zones from overlay
    this.navOverlay.removeChildren()

    const createZone = (
      x: number,
      y: number,
      w: number,
      h: number,
      arrow: number[],
      handler?: () => void,
    ): void => {
      if (!handler) return

      const zone = new Graphics()
      zone.x = x
      zone.y = y
      // Invisible hit area so the whole zone is interactive
      zone.hitArea = new Rectangle(0, 0, w, h)
      // No background by default — only the arrow
      zone.fill({ color: 0xffffff, alpha: 0.12 })
      zone.poly(arrow)
      zone.fill()

      zone.eventMode = 'static'
      zone.cursor = 'pointer'
      zone.alpha = 1

      zone.on('pointerover', () => {
        zone.clear()
        zone.fill({ color: 0xffffff, alpha: 0.06 })
        zone.rect(0, 0, w, h)
        zone.fill()
        zone.fill({ color: 0xffffff, alpha: 0.35 })
        zone.poly(arrow)
        zone.fill()
      })

      zone.on('pointerout', () => {
        zone.clear()
        zone.fill({ color: 0xffffff, alpha: 0.12 })
        zone.poly(arrow)
        zone.fill()
      })

      zone.on('pointerdown', handler)

      this.navOverlay.addChild(zone)
    }

    const cx = ROOM_SIZE / 2
    const cy = ROOM_SIZE / 2
    const ah = 18  // half-height of arrow base (36px total height)

    // West arrow (pointing left) — 12px wide, 36px tall (1:3)
    createZone(-PADDING, 0, PADDING, ROOM_SIZE, [
      18, cy,
      PADDING - 6, cy - ah,
      PADDING - 6, cy + ah,
    ], handlers.west)

    // East arrow (pointing right) — 12px wide, 36px tall (1:3)
    createZone(ROOM_SIZE, 0, PADDING, ROOM_SIZE, [
      PADDING - 18, cy,
      6, cy - ah,
      6, cy + ah,
    ], handlers.east)

    // North arrow (pointing up) — 36px wide, 12px tall (3:1)
    createZone(0, -PADDING, ROOM_SIZE, PADDING, [
      cx, 18,
      cx - ah, PADDING - 6,
      cx + ah, PADDING - 6,
    ], handlers.north)

    // South arrow (pointing down) — 36px wide, 12px tall (3:1)
    createZone(0, ROOM_SIZE, ROOM_SIZE, PADDING, [
      cx, PADDING - 18,
      cx - ah, 6,
      cx + ah, 6,
    ], handlers.south)

    // Trigger pointerover for zones already under the mouse
    for (const child of this.navOverlay.children) {
      const zone = child as Graphics
      const hitArea = zone.hitArea as Rectangle
      const sx = this.world.x + zone.x * this.world.scale.x
      const sy = this.world.y + zone.y * this.world.scale.y
      const sw = hitArea.width * this.world.scale.x
      const sh = hitArea.height * this.world.scale.y
      if (
        this.lastMouseX >= sx &&
        this.lastMouseX <= sx + sw &&
        this.lastMouseY >= sy &&
        this.lastMouseY <= sy + sh
      ) {
        // @ts-expect-error - Event type mismatch with PixiJS event emitter
        zone.emit('pointerover', new Event('pointerover'))
      }
    }
  }

  clear(): void {
    // Remove all children except navOverlay and hoverLayer
    for (let i = this.world.children.length - 1; i >= 0; i--) {
      const child = this.world.children[i]
      if (child !== this.navOverlay && child !== this.hoverLayer.container) {
        this.world.removeChild(child)
      }
    }
    this.navOverlay.removeChildren()
    this.hoverLayer.clearSelection()
    this.hoverLayer.setHoveredTile(null, null)
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
    this.hoverLayer.destroy()
    this.app.destroy(true, { children: true })
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).__PIXI_APP__
    }
  }
}
