// screeps-client/src/stores/roomViewStore.tsx
import { createEffect, createRoot, createSignal, untrack, type JSX } from 'solid-js'
import { controllerLevel, structureCounts } from './roomDataStore.js'
import { client, worldStatus } from './clientStore.js'
import { addToast } from './toastStore.js'
import { createLogger } from '~/utils/log.js'

const { log, warn, error } = createLogger('build')

export type RoomViewMode = 'view' | 'flag' | 'build'

export interface FlagDraft {
    name: string
    color: string
    secondaryColor: string
}

export interface BuildDraft {
    structureType: string
    structureName?: string
}

export const FLAG_COLOR_MAP: Record<string, number> = {
  COLOR_RED: 1,
  COLOR_PURPLE: 2,
  COLOR_BLUE: 3,
  COLOR_CYAN: 4,
  COLOR_GREEN: 5,
  COLOR_YELLOW: 6,
  COLOR_ORANGE: 7,
  COLOR_BROWN: 8,
  COLOR_GREY: 9,
  COLOR_WHITE: 10,
}

export const CONTROLLER_STRUCTURES: Record<string, Record<number, number>> = {
  spawn: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
  extension: { 0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
  link: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
  road: { 0: 2500, 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  constructedWall: { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  rampart: { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  storage: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
  tower: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
  observer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  powerSpawn: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  extractor: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  terminal: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  lab: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
  container: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 },
  nuker: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  factory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
}

export interface PendingTile {
  tx: number
  ty: number
}

export interface MoveFlagAction {
  type: 'moveFlag'
  id: string
  name: string
  room: string
  color: number
  secondaryColor: number
  targetRoom: string
}

export type OverlayAction = MoveFlagAction | null

const [roomViewMode, setRoomViewMode] = createSignal<RoomViewMode>('view')
const [flagDraft, setFlagDraft] = createSignal<FlagDraft>({
    name: '',
    color: 'COLOR_WHITE',
    secondaryColor: 'COLOR_WHITE',
})
const [pendingTile, setPendingTile] = createSignal<PendingTile | null>(null)
const [overlayAction, setOverlayAction] = createSignal<OverlayAction>(null)
const [buildDraft, setBuildDraft] = createSignal<BuildDraft>({
  structureType: '',
  structureName: '',
})

// Auto-deselect the selected structure type when its max is reached.
// Wrapped in createRoot so the module-level effect has a reactive owner.
createRoot(() => {
  createEffect(() => {
    const type = buildDraft().structureType
    if (!type) return
    const rcl = controllerLevel() ?? 0
    const levels = CONTROLLER_STRUCTURES[type]
    if (!levels) return
    const max = worldStatus() === 'empty' && type === 'spawn'
      ? Math.max(levels[rcl] ?? 0, 1)
      : (levels[rcl] ?? 0)
    if (max === 2500) return
    const current = structureCounts()[type] ?? 0
    if (current >= max) {
      setBuildDraft({ structureType: '', structureName: '' })
      clearPendingTile()
    }
  })
})

export { roomViewMode, setRoomViewMode, flagDraft, setFlagDraft, pendingTile, setPendingTile, overlayAction, setOverlayAction, buildDraft, setBuildDraft }

export function clearPendingTile(): void {
  setPendingTile(null)
}

export function clearOverlayAction(): void {
  setOverlayAction(null)
}

export function clearBuildDraft(): void {
  setBuildDraft({ structureType: '', structureName: '' })
}

export function confirmBuild(room: string, shard: string | null): void {
  const c = client()
  const draft = buildDraft()
  const pending = pendingTile()

  if (!c || !draft.structureType || !pending) {
    warn('missing requirements', { hasClient: !!c, structureType: draft.structureType, pending })
    return
  }

  if (worldStatus() === 'empty' && draft.structureType === 'spawn') {
    log('placing spawn', {
      room,
      x: pending.tx,
      y: pending.ty,
      name: draft.structureName || undefined,
      shard: shard ?? undefined,
    })

    c.http.game.placeSpawn(
      room,
      pending.tx,
      pending.ty,
      draft.structureName || undefined,
      shard ?? undefined
    )
      .then(() => {
        log('spawn placed')
        addToast('Spawn placed successfully', 'success')
        clearPendingTile()
        return c.stores.user.refreshWorldStatus()
      })
      .catch((err: Error) => {
        error('place spawn failed:', err)
        addToast(`Failed to place spawn: ${err.message}`, 'error')
      })
    return
  }

  log('creating construction site', {
    room,
    x: pending.tx,
    y: pending.ty,
    structureType: draft.structureType,
    name: draft.structureName || undefined,
    shard: shard ?? undefined,
  })

  c.http.game.createConstruction(
    room,
    pending.tx,
    pending.ty,
    draft.structureType,
    draft.structureName || undefined,
    shard ?? undefined
  )
    .then(() => {
      log('construction site created')
      addToast(`Construction site for ${draft.structureType} created`, 'success')
      clearPendingTile()
    })
    .catch((err: Error) => {
      error('create construction failed:', err)
      addToast(`Failed to create construction site: ${err.message}`, 'error')
    })
}

export function resetRoomViewMode(): void {
    setRoomViewMode('view')
    clearPendingTile()
    clearOverlayAction()
    clearBuildDraft()
}

export function resetRoomViewModeOnNavigate(): void {
    setRoomViewMode('view')
    clearPendingTile()
    // untrack: must not add overlayAction as a dependency of whatever effect calls this
    if (untrack(overlayAction)?.type !== 'moveFlag') {
        clearOverlayAction()
    }
    clearBuildDraft()
}

export function modeHint(): JSX.Element | null {
  const mode = roomViewMode()
  const pending = pendingTile()
  const overlay = overlayAction()
  const worldStatusValue = worldStatus()

  if (worldStatusValue === 'empty') {
    return (
      <div style={{ 'text-align': 'center', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px' }}>
        <div style={{ 'font-size': '14px', 'font-weight': 600, color: '#f85149' }}>
          You have no rooms!
        </div>
        <button
          onClick={() => {
            setRoomViewMode('build')
            setBuildDraft({ structureType: 'spawn', structureName: '' })
          }}
          style={{
            padding: '4px 12px',
            'border-radius': '4px',
            border: '1px solid #238636',
            background: '#1a3a2a',
            color: '#3fb950',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          Place Spawn
        </button>
      </div>
    )
  }

  if (worldStatusValue === 'lost') {
    return (
      <div style={{ 'text-align': 'center', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px' }}>
        <div style={{ 'font-size': '14px', 'font-weight': 600, color: '#f85149' }}>
          You lost all your spawns!
        </div>
        <button
          onClick={() => {
            const c = client()
            if (!c) return
            c.http.user.respawn()
              .then(() => {
                addToast('Respawn successful', 'success')
                void c.stores.user.refreshWorldStatus()
              })
              .catch((err: Error) => {
                addToast(`Respawn failed: ${err.message}`, 'error')
              })
          }}
          style={{
            padding: '4px 12px',
            'border-radius': '4px',
            border: '1px solid #da3633',
            background: '#3d1a1a',
            color: '#f85149',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          Respawn
        </button>
      </div>
    )
  }

  if (overlay?.type === 'moveFlag') {
    return (
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'text-align': 'center' }}>
        <span>Moving "{overlay.name}" → {overlay.targetRoom}</span>
        <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Navigate rooms or change target in sidebar · Right-click to cancel</span>
      </div>
    )
  }

  if (mode === 'flag') {
    return (
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'text-align': 'center' }}>
        <span>{pending ? 'Click again to confirm position' : 'Click to choose flag position'}</span>
        <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Right-click to exit flag mode</span>
      </div>
    )
  }

  if (mode === 'build') {
    const draft = buildDraft()
    const level = controllerLevel()
    const counts = structureCounts()
    const type = draft.structureType

    if (!type) {
      return (
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'text-align': 'center' }}>
          <span>Select a structure type, then click to build</span>
          <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Ctrl+click to remove construction sites</span>
          <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Right-click to exit build mode</span>
        </div>
      )
    }

    const levels = CONTROLLER_STRUCTURES[type]
    const max = levels?.[level ?? 0] ?? 0
    const current = counts[type] ?? 0
    const display = type.replace(/([A-Z])/g, ' $1').trim()
    const countStr = max === 2500 ? `${current}/∞` : `${current}/${max}`

    return (
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'text-align': 'center' }}>
        <span>{`Click to build ${display} (${countStr})`}</span>
        <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Ctrl+click to remove construction sites</span>
        <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>Right-click to exit build mode</span>
      </div>
    )
  }

  return null
}