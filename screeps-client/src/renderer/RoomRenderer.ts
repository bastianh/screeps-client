import { Application, Container, Point } from 'pixi.js'

export const TILE_SIZE = 12
export const ROOM_SIZE = 50 * TILE_SIZE

export class RoomRenderer {
  readonly app: Application
  readonly world: Container
  private destroyed = false

  private constructor(app: Application) {
    this.app = app
    this.world = new Container()
    this.app.stage.addChild(this.world)
    this.setupCamera()
    this.centerView()
  }

  static async create(container: HTMLElement): Promise<RoomRenderer> {
    const app = new Application()
    await app.init({
      background: '#0d1117',
      resizeTo: container,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    container.appendChild(app.canvas)
    return new RoomRenderer(app)
  }

  private setupCamera(): void {
    let dragging = false
    let lastPos = new Point(0, 0)
    const canvas = this.app.canvas

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true
      lastPos = new Point(e.clientX, e.clientY)
      canvas.setPointerCapture(e.pointerId)
    })

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - lastPos.x
      const dy = e.clientY - lastPos.y
      this.world.x += dx
      this.world.y += dy
      lastPos = new Point(e.clientX, e.clientY)
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
      const newScale = Math.max(0.2, Math.min(5, this.world.scale.x * scaleFactor))

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const worldX = (mouseX - this.world.x) / this.world.scale.x
      const worldY = (mouseY - this.world.y) / this.world.scale.y

      this.world.scale.set(newScale)
      this.world.x = mouseX - worldX * newScale
      this.world.y = mouseY - worldY * newScale
    }, { passive: false })
  }

  private centerView(): void {
    const cx = this.app.screen.width / 2
    const cy = this.app.screen.height / 2
    this.world.x = cx - ROOM_SIZE / 2
    this.world.y = cy - ROOM_SIZE / 2
  }

  clear(): void {
    this.world.removeChildren()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.app.destroy(true, { children: true })
  }
}
