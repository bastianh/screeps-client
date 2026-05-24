import { Container, Graphics, Ticker } from 'pixi.js'
import { TILE_SIZE } from './RoomRenderer.js'

export interface SelectionVisual {
  id: string
  type: string
  /** The live PixiJS container for this object (from ObjectLayer) */
  visual: Container
}

/**
 * Renders hover tile highlight and selection overlays (circles for creeps,
 * boxes for structures) above the object layer.
 */
export class HoverHighlightLayer {
  readonly container: Container

  private hoverGraphics: Graphics
  private pendingGraphics: Graphics
  private selectionContainer: Container
  /** Map from object id → Graphics overlay */
  private selectionGraphics = new Map<string, Graphics>()
  /** Map from object id → type (to know circle vs box) */
  private selectionTypes = new Map<string, string>()
  /** Map from object id → live visual Container for position tracking */
  private selectionVisuals = new Map<string, Container>()

  private ticker: Ticker | null = null
  private tickerCallback: (() => void) | null = null

  constructor(ticker?: Ticker) {
    this.container = new Container()
    this.container.label = 'hoverHighlight'
    this.container.eventMode = 'none'

    this.hoverGraphics = new Graphics()
    this.hoverGraphics.eventMode = 'none'
    this.container.addChild(this.hoverGraphics)

    this.pendingGraphics = new Graphics()
    this.pendingGraphics.eventMode = 'none'
    this.container.addChild(this.pendingGraphics)

    this.selectionContainer = new Container()
    this.selectionContainer.eventMode = 'none'
    this.container.addChild(this.selectionContainer)

    if (ticker) {
      this.ticker = ticker
      this.tickerCallback = () => this.trackCreepRings()
      ticker.add(this.tickerCallback)
    }
  }

  /** Update the hover highlight to the given tile, or clear if null. */
  setHoveredTile(tx: number | null, ty: number | null): void {
    this.hoverGraphics.clear()
    if (tx === null || ty === null) return

    const px = tx * TILE_SIZE
    const py = ty * TILE_SIZE
    this.hoverGraphics.rect(px, py, TILE_SIZE, TILE_SIZE)
    this.hoverGraphics.stroke({ width: 1, color: 0xffffff, alpha: 0.35 })
    this.hoverGraphics.rect(px, py, TILE_SIZE, TILE_SIZE)
    this.hoverGraphics.fill({ color: 0xffffff, alpha: 0.06 })
  }

  /** Replace the current selection overlays with overlays for the given objects. */
  setSelectedObjects(objects: SelectionVisual[]): void {
    // Tear down existing
    this.selectionContainer.removeChildren()
    for (const g of this.selectionGraphics.values()) g.destroy()
    this.selectionGraphics.clear()
    this.selectionTypes.clear()
    this.selectionVisuals.clear()

    for (const { id, type, visual } of objects) {
      const g = new Graphics()
      g.eventMode = 'none'
      this.selectionContainer.addChild(g)
      this.selectionGraphics.set(id, g)
      this.selectionTypes.set(id, type)
      this.selectionVisuals.set(id, visual)

      if (type === 'creep') {
        // Draw ring at current position immediately; ticker will update it
        this.drawCreepRing(g, visual.x, visual.y)
      } else {
        // Structures sit at tile position (no interpolation)
        this.drawStructureBox(g, visual.x, visual.y)
      }
    }
  }

  /** Clear all selection overlays. */
  clearSelection(): void {
    this.selectionContainer.removeChildren()
    for (const g of this.selectionGraphics.values()) g.destroy()
    this.selectionGraphics.clear()
    this.selectionTypes.clear()
    this.selectionVisuals.clear()
  }

  /** Show a crosshair marker on the given tile, or clear if null. */
  setPendingTile(tx: number | null, ty: number | null): void {
    this.pendingGraphics.clear()
    if (tx === null || ty === null) return

    const px = tx * TILE_SIZE
    const py = ty * TILE_SIZE
    const cx = px + TILE_SIZE / 2
    const cy = py + TILE_SIZE / 2
    const r = TILE_SIZE * 0.35

    // Crosshair lines
    this.pendingGraphics.moveTo(cx - r, cy)
    this.pendingGraphics.lineTo(cx + r, cy)
    this.pendingGraphics.moveTo(cx, cy - r)
    this.pendingGraphics.lineTo(cx, cy + r)
    this.pendingGraphics.stroke({ width: 1.5, color: 0xf0883e, alpha: 0.9 })

    // Outer box
    this.pendingGraphics.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    this.pendingGraphics.stroke({ width: 1.5, color: 0xf0883e, alpha: 0.6 })
  }

  /** Clear the pending tile marker. */
  clearPendingTile(): void {
    this.pendingGraphics.clear()
  }

  private drawCreepRing(g: Graphics, x: number, y: number): void {
    g.clear()
    const cx = x + TILE_SIZE / 2
    const cy = y + TILE_SIZE / 2
    const r = TILE_SIZE * 0.48
    g.circle(cx, cy, r)
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 })
  }

  private drawStructureBox(g: Graphics, x: number, y: number): void {
    g.clear()
    const pad = 1
    g.rect(x + pad, y + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 })
    g.rect(x + pad, y + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
    g.fill({ color: 0xffffff, alpha: 0.04 })
  }

  /** Called each ticker frame to keep creep rings locked to their animated visuals. */
  private trackCreepRings(): void {
    for (const [id, g] of this.selectionGraphics) {
      if (this.selectionTypes.get(id) !== 'creep') continue
      const visual = this.selectionVisuals.get(id)
      if (!visual || visual.destroyed) continue
      this.drawCreepRing(g, visual.x, visual.y)
    }
  }

  destroy(): void {
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback)
    }
    this.ticker = null
    this.tickerCallback = null
    this.clearSelection()
    this.clearPendingTile()
    this.pendingGraphics.destroy()
    this.hoverGraphics.destroy()
    this.container.destroy()
  }
}
