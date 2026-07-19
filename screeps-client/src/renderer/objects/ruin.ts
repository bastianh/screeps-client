import { Graphics } from 'pixi.js'
import { TILE_SIZE } from '../RoomRenderer.js'
import { OBJ_FOREIGN, CS_OWN } from '../colors.js'
import { type VisualBuildContext } from './types.js'

// Ruin visuals: broken ring segments with a central X.
export function createRuinVisual(ctx: VisualBuildContext): void {
  const { obj, container, cx, cy, currentUserId } = ctx
  const rUser = typeof obj.user === 'string' ? obj.user : undefined
  const isMine = rUser !== undefined && rUser === currentUserId
  const rColor = isMine ? CS_OWN : OBJ_FOREIGN

  // Broken outer ring — short arc segments with gaps suggest a destroyed structure
  const ringR = TILE_SIZE * 0.42
  const segCount = 6
  const arcLen = Math.PI / 5
  const ringG = new Graphics()
  for (let i = 0; i < segCount; i++) {
    const center = (i * Math.PI * 2) / segCount
    const start = center - arcLen / 2
    const end = center + arcLen / 2
    const sx = cx + ringR * Math.cos(start)
    const sy = cy + ringR * Math.sin(start)
    ringG.moveTo(sx, sy)
    ringG.arc(cx, cy, ringR, start, end)
    ringG.stroke({ width: TILE_SIZE * 0.09, color: rColor, alpha: 0.75, cap: 'round' })
  }
  container.addChild(ringG)

  // Central X — same color
  const xR = TILE_SIZE * 0.18
  const xMark = new Graphics()
  xMark.moveTo(cx - xR, cy - xR)
  xMark.lineTo(cx + xR, cy + xR)
  xMark.moveTo(cx + xR, cy - xR)
  xMark.lineTo(cx - xR, cy + xR)
  xMark.stroke({ width: TILE_SIZE * 0.11, color: rColor, cap: 'round' })
  container.addChild(xMark)
}
