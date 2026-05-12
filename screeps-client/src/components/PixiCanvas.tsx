import { createSignal, onCleanup, onMount } from 'solid-js'
import { Application, Graphics } from 'pixi.js'

export function PixiCanvas() {
  let containerRef: HTMLDivElement | undefined
  const [app, setApp] = createSignal<Application | null>(null)

  onMount(async () => {
    if (!containerRef) return

    const pixi = new Application()
    await pixi.init({
      background: '#0d1117',
      resizeTo: containerRef,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    containerRef.appendChild(pixi.canvas)

    // Demo: draw a grid of colored tiles to verify rendering
    const tileSize = 20
    const cols = 25
    const rows = 25
    const graphics = new Graphics()

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const color = (x + y) % 3 === 0 ? 0x4a6741 : (x + y) % 3 === 1 ? 0x5c4033 : 0x2d333b
        graphics.rect(x * tileSize, y * tileSize, tileSize, tileSize)
        graphics.fill(color)
        graphics.rect(x * tileSize, y * tileSize, tileSize, tileSize)
        graphics.stroke({ width: 0.5, color: 0x21262d })
      }
    }

    pixi.stage.addChild(graphics)
    setApp(pixi)
  })

  onCleanup(() => {
    const a = app()
    if (a) {
      a.destroy(true, { children: true })
    }
  })

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
