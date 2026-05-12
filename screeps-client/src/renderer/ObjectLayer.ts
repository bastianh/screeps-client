import { Container, Graphics, Text, Ticker } from 'pixi.js'
import type { RoomObject, RoomObjectMap } from 'screeps-connectivity'
import { TILE_SIZE } from './RoomRenderer.js'

const OBJECT_COLORS: Record<string, number> = {
  creep: 0xf0883e,
  spawn: 0x58a6ff,
  extension: 0x79c0ff,
  tower: 0x3fb950,
  container: 0x8b949e,
  storage: 0xd29922,
  link: 0xa371f7,
  rampart: 0x58a6ff,
  road: 0x484f58,
  wall: 0x21262d,
  extractor: 0x8b949e,
  lab: 0xf778ba,
  terminal: 0xd29922,
  observer: 0x79c0ff,
  powerSpawn: 0xf0883e,
  nuker: 0xf85149,
  factory: 0x8b949e,
  invaderCore: 0xf85149,
  source: 0xd29922,
  mineral: 0x79c0ff,
  deposit: 0xd29922,
  controller: 0x58a6ff,
  powerBank: 0xf0883e,
  portal: 0xa371f7,
}

function getObjectColor(type: string): number {
  return OBJECT_COLORS[type] ?? 0xc9d1d9
}

function createObjectVisual(obj: RoomObject): Container {
  const container = new Container()
  const g = new Graphics()
  const color = getObjectColor(obj.type)
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2

  switch (obj.type) {
    case 'creep': {
      g.circle(cx, cy, TILE_SIZE * 0.35)
      g.fill(color)
      break
    }
    case 'source':
    case 'mineral':
    case 'deposit': {
      g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
      g.fill(color)
      break
    }
    case 'controller': {
      g.circle(cx, cy, TILE_SIZE * 0.4)
      g.fill(color)
      g.circle(cx, cy, TILE_SIZE * 0.25)
      g.stroke({ width: 1, color: 0xffffff })
      break
    }
    case 'energy': {
      g.circle(cx, cy, TILE_SIZE * 0.2)
      g.fill(0xd29922)
      break
    }
    default: {
      // Structures
      const size = TILE_SIZE - 2
      g.rect(1, 1, size, size)
      g.fill(color)
    }
  }

  container.addChild(g)

  // Label for creeps
  if (obj.type === 'creep' && typeof obj.name === 'string') {
    const label = new Text({
      text: obj.name as string,
      style: {
        fontSize: 8,
        fill: 0xffffff,
      },
    })
    label.anchor.set(0.5, 1)
    label.x = cx
    label.y = -2
    container.addChild(label)
  }

  container.position.set(obj.x * TILE_SIZE, obj.y * TILE_SIZE)
  return container
}

type ContainerWithTarget = Container & {
  __targetX?: number
  __targetY?: number
}

export class ObjectLayer {
  readonly container: Container
  private objects = new Map<string, ContainerWithTarget>()
  private ticker: Ticker | null = null
  private tickerCallback: (() => void) | null = null

  constructor(ticker?: Ticker) {
    this.container = new Container()
    if (ticker) {
      this.ticker = ticker
      this.tickerCallback = () => {
        for (const visual of this.objects.values()) {
          const targetX = visual.__targetX
          const targetY = visual.__targetY
          if (targetX !== undefined && targetY !== undefined) {
            const dx = targetX - visual.x
            const dy = targetY - visual.y
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
              visual.position.set(targetX, targetY)
              visual.__targetX = undefined
              visual.__targetY = undefined
            } else {
              visual.x += dx * 0.15
              visual.y += dy * 0.15
            }
          }
        }
      }
      ticker.add(this.tickerCallback)
    }
  }

  update(objects: RoomObjectMap): void {
    const seen = new Set<string>()

    for (const [id, obj] of Object.entries(objects)) {
      seen.add(id)
      const existing = this.objects.get(id)
      if (!existing) {
        const visual: ContainerWithTarget = createObjectVisual(obj)
        this.objects.set(id, visual)
        this.container.addChild(visual)
      } else {
        const tx = obj.x * TILE_SIZE
        const ty = obj.y * TILE_SIZE
        if (obj.type === 'creep') {
          if (existing.x !== tx || existing.y !== ty) {
            existing.__targetX = tx
            existing.__targetY = ty
          }
        } else {
          existing.position.set(tx, ty)
        }
      }
    }

    // Remove objects that no longer exist
    for (const [id, visual] of this.objects) {
      if (!seen.has(id)) {
        this.container.removeChild(visual)
        visual.destroy()
        this.objects.delete(id)
      }
    }
  }

  clear(): void {
    for (const visual of this.objects.values()) {
      visual.destroy()
    }
    this.objects.clear()
    this.container.removeChildren()
  }

  destroy(): void {
    this.clear()
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback)
    }
    this.ticker = null
    this.tickerCallback = null
  }
}
