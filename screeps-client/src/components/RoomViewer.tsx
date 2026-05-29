import { createEffect, createSignal, onCleanup, onMount, untrack, Show } from 'solid-js'

import { RoomRenderer } from '~/renderer/RoomRenderer.js'
import { createTerrainLayer, setTerrainEffectsVisible } from '~/renderer/TerrainLayer.js'
import { ObjectLayer } from '~/renderer/ObjectLayer.js'
import { ActionAnimationLayer } from '~/renderer/ActionAnimationLayer.js'
import { VisualLayer } from '~/renderer/VisualLayer.js'
import { client, gameTime, setGameTime, recordGameTime, tickDuration, worldBounds, userInfo, worldStatus, serverVersion, isPrivateServer } from '~/stores/clientStore.js'
import { showCreepLabels, terrainEffects, showRoomVisuals, spriteTheme } from '~/stores/settingsStore.js'
import { defaultSpriteTheme } from '~/renderer/themes/default.js'
import { sharedAtlasCache } from '~/renderer/AtlasCache.js'
import { setSelection, clearSelection, selection, updateSelectionWithDiff, updateSelectionFromObjects, createSelectedObject } from '~/stores/selectionStore.js'
import { addToast } from '~/stores/toastStore.js'
import { setRoomObjectCount, setRoomOwner, setControllerLevel, setControllerProgress, setStructureCounts, setRoomUsers, roomUsers, setCurrentShard, setCurrentRoom } from '~/stores/roomDataStore.js'
import { parseRoomName, formatRoomName, isRoomInWorld } from '~/utils/roomName.js'
import { useRoomNavigationKeys } from '~/utils/useRoomNavigationKeys.js'
import type { Badge, RoomTerrain, RoomObjectMap, RoomObjectDiff } from 'screeps-connectivity'
import { SubscriptionGroup } from 'screeps-connectivity'
import { historyMode, historyTick, historyMinTick, historyMaxTick, setHistoryMaxTick, historyLoading, setHistoryLoading, seekToTick, playbackSpeed } from '~/stores/historyStore.js'
import { HistoryPlayer } from '~/stores/HistoryPlayer.js'
import {flagDraft, roomViewMode, FLAG_COLOR_MAP, pendingTile, setPendingTile, clearPendingTile, setFlagDraft, modeHint, overlayAction, setOverlayAction, clearOverlayAction, buildDraft, confirmBuild, resetRoomViewMode, resetRoomViewModeOnNavigate} from '~/stores/roomViewStore';
import { createLogger } from '~/utils/log.js'

const { log, error } = createLogger('room')

interface RoomViewerProps {
  room: string
  shard: string | null
  onNavigate?: (room: string, shard: string | null) => void
}

export function RoomViewer(props: RoomViewerProps) {
  const resolveTheme = (id: string) => id === 'default' ? defaultSpriteTheme : null

  let containerRef: HTMLDivElement | undefined
  let objLayer: ObjectLayer | null = null
  let lastRawState: { objects: RoomObjectMap; users?: Record<string, { _id: string; username: string; badge?: Badge }> } | null = null
  let animLayer: ActionAnimationLayer | null = null
  let visualLayer: VisualLayer | null = null
  let terrainLayerRef: ReturnType<typeof createTerrainLayer> | null = null
  const [renderer, setRenderer] = createSignal<RoomRenderer | null>(null)
  const [terrain, setTerrain] = createSignal<{ room: string, data: RoomTerrain } | null>(null)
  const [objectState, setObjectState] = createSignal<{ objects: RoomObjectMap, diff?: RoomObjectDiff, users?: Record<string, { _id: string; username: string; badge?: Badge }> } | null>(null)
  const [visualState, setVisualState] = createSignal<string>('')
  const [sliderValue, setSliderValue] = createSignal(historyTick())
  createEffect(() => setSliderValue(historyTick()))

  let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null

  onMount(async () => {
    if (!containerRef) return
    const r = await RoomRenderer.create(containerRef)
    setRenderer(r)
  })

  onCleanup(() => {
    if (seekDebounceTimer !== null) clearTimeout(seekDebounceTimer)
    objLayer?.destroy()
    objLayer = null
    animLayer?.destroy()
    animLayer = null
    visualLayer?.destroy()
    visualLayer = null
    const r = renderer()
    if (r) r.destroy()
  })

  // Subscribe to room data as soon as client is ready (no renderer dependency to avoid
  // a race where PixiJS init finishes after the initial room state arrives)
  createEffect(() => {
    const c = client()
    if (!c || historyMode()) return

    const room = props.room
    const shard = props.shard

    log(`navigate → ${room} (shard=${shard ?? 'default'})`)
    setTerrain(null)
    setObjectState(null)
    setVisualState('')
    setGameTime(null)
    clearSelection()
    setCurrentRoom(room)
    setCurrentShard(shard)
    setRoomObjectCount(null)
    setRoomOwner(null)
    setControllerLevel(null)
    setControllerProgress(null)
    setStructureCounts({})
    setRoomUsers(null)

    const group = new SubscriptionGroup()

    let terrainCancelled = false
    c.stores.room.terrain(room, shard)
      .then((t) => {
        if (!terrainCancelled) {
          log(`terrain loaded — ${room}`)
          setTerrain({ room, data: t })
        }
      })
      .catch((err) => { if (!terrainCancelled) error(`terrain load failed for ${room}:`, err) })

    group.add(c.stores.room.subscribe(room, shard))
    group.add(c.stores.room.on('room:error', (data) => {
      addToast(`Room subscription error (${data.room}): ${data.message}`, 'error', 8000)
    }))
    group.add(c.stores.room.on('room:update', (data) => {
      // Single for...in pass: count objects, sum structures, extract controller owner —
      // avoids allocating Object.values() / Object.entries() arrays on the hot path.
      let objectCount = 0
      const structCounts: Record<string, number> = {}
      let ctrlLevel = 0
      let ctrlProgress: number | null = null
      let owner: { userId: string; username: string } | null = null

      for (const id in data.objects) {
        objectCount++
        const obj = data.objects[id]
        if (!obj) continue

        const objType = obj.type
        if (typeof objType === 'string') {
          if (objType === 'constructionSite') {
            const structureType = obj.structureType
            if (typeof structureType === 'string') {
              structCounts[structureType] = (structCounts[structureType] || 0) + 1
            }
          } else {
            structCounts[objType] = (structCounts[objType] || 0) + 1
          }
        }

        if (objType === 'controller' && typeof obj.user === 'string') {
          const userId = obj.user
          const username = data.users?.[userId]?.username ?? userId
          owner = { userId, username }
          if (typeof obj.level === 'number') {
            ctrlLevel = obj.level
          }
          if (typeof obj.progress === 'number') {
            ctrlProgress = obj.progress
          }
        }
      }

      if (!data.diff) {
        log(`objects loaded — ${room}: ${objectCount} objects, tick=${data.gameTime}`)
      }
      setObjectState({ objects: data.objects, diff: data.diff, users: data.users })
      setVisualState(data.visual)
      setGameTime(data.gameTime ?? null)
      recordGameTime(data.gameTime)
      setRoomObjectCount(objectCount)
      setRoomOwner(owner)
      setControllerLevel(ctrlLevel || null)
      setControllerProgress(ctrlProgress)
      setStructureCounts(structCounts)
      setRoomUsers(data.users ?? null)
    }))

    onCleanup(() => {
      log(`leaving ${room}`)
      terrainCancelled = true
      group.dispose()
    })
  })

  // History mode: fetch tick state from HTTP instead of WebSocket
  createEffect(() => {
    const c = client()
    if (!c || !historyMode()) return

    setVisualState('')

    const room = props.room
    const shard = props.shard
    const isPriv = isPrivateServer() ?? true
    const chunkSize = serverVersion()?.serverData?.historyChunkSize ?? (isPriv ? 20 : 100)
    const cachedUsers = untrack(roomUsers) ?? undefined

    const player = new HistoryPlayer(room, shard, c.http.baseUrl, () => c.http.token, chunkSize, isPriv)

    createEffect(() => {
      const tick = historyTick()
      let cancelled = false
      setHistoryLoading(true)

      player.getStateAtTick(tick)
        .then((state) => {
          if (cancelled) return
          setHistoryLoading(false)
          // If the requested chunk didn't exist yet, clamp the history range down
          if (state.clampedTo !== undefined) {
            setHistoryMaxTick(state.clampedTo)
            seekToTick(state.clampedTo)
            return
          }
          setObjectState({ objects: state.objects, diff: undefined, users: cachedUsers })
          setGameTime(state.gameTime)

          let objectCount = 0
          const structCounts: Record<string, number> = {}
          let ctrlLevel = 0
          let ctrlProgress: number | null = null
          let owner: { userId: string; username: string } | null = null

          for (const id in state.objects) {
            objectCount++
            const obj = state.objects[id]
            if (!obj) continue
            const objType = obj.type
            if (typeof objType === 'string') {
              if (objType === 'constructionSite') {
                const structureType = obj.structureType
                if (typeof structureType === 'string') {
                  structCounts[structureType] = (structCounts[structureType] || 0) + 1
                }
              } else {
                structCounts[objType] = (structCounts[objType] || 0) + 1
              }
            }
            if (objType === 'controller' && typeof obj.user === 'string') {
              const userId = obj.user
              const username = cachedUsers?.[userId]?.username ?? userId
              owner = { userId, username }
              if (typeof obj.level === 'number') ctrlLevel = obj.level
              if (typeof obj.progress === 'number') ctrlProgress = obj.progress
            }
          }

          setRoomObjectCount(objectCount)
          setRoomOwner(owner)
          setControllerLevel(ctrlLevel || null)
          setControllerProgress(ctrlProgress)
          setStructureCounts(structCounts)
        })
        .catch((err: Error) => {
          if (cancelled) return
          setHistoryLoading(false)
          addToast(`History load failed for tick ${tick}: ${err.message}`, 'error', 5000)
        })

      onCleanup(() => { cancelled = true })
    })
  })

  // Clear and reset when renderer or room changes (worldBounds intentionally NOT tracked here
  // — it arriving after login must not re-clear the scene and lose the terrain layer)
  createEffect(() => {
    const r = renderer()
    if (!r) return

    void props.room
    void props.shard

    resetRoomViewModeOnNavigate()
    r.hoverLayer.clearPendingTile()

    // Keep the overlay alive for cross-room flag moves; update targetRoom to the new room
    const activeOverlay = untrack(overlayAction)
    if (activeOverlay?.type === 'moveFlag') {
      setOverlayAction({ ...activeOverlay, targetRoom: props.room })
    } else {
      r.resetView()
    }

    terrainLayerRef?.destroy()
    terrainLayerRef = null
    r.clear()
    r.resetView()
    objLayer?.destroy()
    objLayer = null
    animLayer?.destroy()
    animLayer = null
    visualLayer?.destroy()
    visualLayer = null

    // Apply terrain immediately if it arrived before this clear ran
    const t = untrack(terrain)
    if (t && t.room === props.room) {
      log(`terrain applied immediately (pre-loaded) — ${props.room}`)
      terrainLayerRef = createTerrainLayer(t.data, r.app.renderer)
      setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
      r.world.addChildAt(terrainLayerRef, 0)
      r.bringNavOverlayToTop()
    }

    // Re-create navigation zones immediately after clear so arrows are never missing
    // after a room change. We untrack worldBounds/onNavigate so this effect only runs
    // when room/shard/renderer changes (matching the clear trigger).
    const room = props.room
    const shard = props.shard
    const coord = parseRoomName(room)
    const nav = untrack(() => props.onNavigate)
    const bounds = untrack(worldBounds)
    if (coord && nav) {
      const canNavigate = (tx: number, ty: number) =>
        !bounds || isRoomInWorld(tx, ty, bounds)

      const navTo = (target: string) => {
        log(`navigate requested: ${room} → ${target}`)
        nav(target, shard)
      }

      r.setupNavigationZones({
        west:  canNavigate(coord.x - 1, coord.y) ? () => navTo(formatRoomName(coord.x - 1, coord.y)) : undefined,
        east:  canNavigate(coord.x + 1, coord.y) ? () => navTo(formatRoomName(coord.x + 1, coord.y)) : undefined,
        north: canNavigate(coord.x, coord.y - 1) ? () => navTo(formatRoomName(coord.x, coord.y - 1)) : undefined,
        south: canNavigate(coord.x, coord.y + 1) ? () => navTo(formatRoomName(coord.x, coord.y + 1)) : undefined,
      })
    }
  })

  // Setup navigation zones — separate effect so worldBounds / onNavigate updates
  // only re-wire nav callbacks without triggering a full scene clear.
  // room/shard are read via untrack because the clear-effect above already
  // rebuilds zones on every room change.
  createEffect(() => {
    const r = renderer()
    if (!r) return

    const room = untrack(() => props.room)
    const shard = untrack(() => props.shard)
    const coord = parseRoomName(room)

    if (coord && props.onNavigate) {
      const nav = props.onNavigate
      const bounds = worldBounds()
      const canNavigate = (tx: number, ty: number) =>
        !bounds || isRoomInWorld(tx, ty, bounds)

      const navTo = (target: string) => {
        log(`navigate requested: ${room} → ${target}`)
        nav(target, shard)
      }

      useRoomNavigationKeys({
        currentRoom: () => props.room,
        worldBounds,
        onMove: (rx, ry) => navTo(formatRoomName(rx, ry)),
      })

      r.setupNavigationZones({
        west:  canNavigate(coord.x - 1, coord.y) ? () => navTo(formatRoomName(coord.x - 1, coord.y)) : undefined,
        east:  canNavigate(coord.x + 1, coord.y) ? () => navTo(formatRoomName(coord.x + 1, coord.y)) : undefined,
        north: canNavigate(coord.x, coord.y - 1) ? () => navTo(formatRoomName(coord.x, coord.y - 1)) : undefined,
        south: canNavigate(coord.x, coord.y + 1) ? () => navTo(formatRoomName(coord.x, coord.y + 1)) : undefined,
      })
    }
  })

  // Clear pending marker when switching back to view mode
  createEffect(() => {
    const mode = roomViewMode()
    const r = renderer()
    if (mode === 'view' && r) {
      clearPendingTile()
      r.hoverLayer.clearPendingTile()
    }
  })

  // Sync pending tile changes to hoverLayer (e.g., when cleared from Sidebar)
  createEffect(() => {
    const r = renderer()
    const pending = pendingTile()
    if (!r) return
    if (pending) {
      r.hoverLayer.setPendingTile(pending.tx, pending.ty)
    } else {
      r.hoverLayer.clearPendingTile()
    }
  })

  // Apply terrain when it changes; skip if the clear-effect already applied it
  createEffect(() => {
    const r = renderer()
    const t = terrain()
    if (!r || !t || t.room !== props.room) return

    if (terrainLayerRef?.parent) {
      log(`terrain already in scene, skipping — ${props.room}`)
      return
    }
    log(`terrain applied (async) — ${props.room}`)
    terrainLayerRef = createTerrainLayer(t.data, r.app.renderer)
    setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
    r.world.addChildAt(terrainLayerRef, 0)
    r.bringNavOverlayToTop()
  })

  // Render objects when they update
  createEffect(() => {
    const r = renderer()
    const state = objectState()
    if (!r) return
    if (!state) {
      objLayer?.clear()
      animLayer?.clear()
      return
    }

    const { objects: objs, diff, users } = state

    if (!objLayer) {
      log(`object layer created — ${props.room}`)
      objLayer = new ObjectLayer(r.app.ticker, showCreepLabels(), userInfo()?._id, userInfo()?.badge, users)
      objLayer.setTheme(resolveTheme(untrack(spriteTheme)), sharedAtlasCache)
      objLayer.setInstantMode(untrack(historyMode))
      objLayer.container.label = 'objects'
      r.world.addChild(objLayer.container)
      r.bringNavOverlayToTop()

      animLayer = new ActionAnimationLayer(r.app.ticker)
      animLayer.container.label = 'animations'
      r.world.addChild(animLayer.container)

      visualLayer = new VisualLayer()
      r.world.addChild(visualLayer.container)
      r.bringNavOverlayToTop()

      // Wire up tile click → current room interaction mode.
      // setTileHandlers is registered once for the lifetime of the renderer;
      // the click handler must read live props.room/props.shard at invocation
      // time, so the solid/reactivity check is intentionally suppressed below.
      r.setTileHandlers(
          // hover: nothing extra needed beyond what HoverHighlightLayer does internally
          (_tx, _ty) => {},
          // eslint-disable-next-line solid/reactivity
          (tx, ty, ctrlKey) => {
            const currentRoom = props.room
            const currentShard = props.shard
            const mode = roomViewMode()

            const overlay = overlayAction()

            if (overlay?.type === 'moveFlag') {
              const c = client()
              if (!c) return

              const { name, room: flagRoom, color, secondaryColor, targetRoom } = overlay
              c.http.game.removeFlag(flagRoom, name)
                .then(() => {
                  return c.http.game.createFlag(
                    targetRoom, tx, ty, name, color, secondaryColor, currentShard ?? undefined
                  )
                })
                .then(() => {
                  addToast(`Flag "${name}" moved`, 'success')
                  clearOverlayAction()
                })
                .catch((err) => {
                  error('move flag failed:', err)
                  addToast(`Failed to move flag "${name}"`, 'error')
                  clearOverlayAction()
                })
              return
            }

            if (mode === 'flag') {
              const pending = pendingTile()
              if (!pending || pending.tx !== tx || pending.ty !== ty) {
                setPendingTile({ tx, ty })
                r.hoverLayer.setPendingTile(tx, ty)
                return
              }

              const c = client()
              if (!c) return

              const draft = flagDraft()
              const name = draft.name.trim()
              if (!name) {
                addToast('Flag name is required', 'error')
                return
              }

              const color = FLAG_COLOR_MAP[draft.color] ?? 0
              const secondaryColor = FLAG_COLOR_MAP[draft.secondaryColor] ?? 0
              c.http.game.createFlag(currentRoom, tx, ty, name, color, secondaryColor, currentShard ?? undefined)
                  .then(() => {
                    addToast(`Flag "${name}" created`, 'success')
                    clearPendingTile()
                    r.hoverLayer.clearPendingTile()
                    c.http.game.genUniqueFlagName()
                        .then((res) => setFlagDraft(prev => ({ ...prev, name: res.name })))
                        .catch((err) => error('gen unique flag name failed:', err))
                  })
                  .catch((err) => error('create flag failed:', err))
              return
            }

            if (mode === 'build') {
              if (!ctrlKey && !buildDraft().structureType) {
                addToast('Select a structure type first', 'error')
                return
              }

              if (ctrlKey) {
                if (!objLayer) return
                const hits = objLayer.getObjectsAtTile(tx, ty)
                const sites = hits.filter(({ obj }) => obj.type === 'constructionSite')
                if (sites.length === 0) {
                  addToast('No construction sites on this tile', 'error')
                  return
                }
                const c = client()
                if (!c) return
                c.http.game.removeConstructionSite(currentRoom, sites.map(({ id }) => id), currentShard ?? undefined)
                  .then(() => {
                    addToast(`Removed ${sites.length} construction site${sites.length > 1 ? 's' : ''}`, 'success')
                    clearPendingTile()
                    r.hoverLayer.clearPendingTile()
                  })
                  .catch((err) => {
                    error('remove construction sites failed:', err)
                    addToast(`Failed to remove construction sites: ${err.message}`, 'error')
                  })
                return
              }

              setPendingTile({ tx, ty })
              r.hoverLayer.setPendingTile(tx, ty)
              confirmBuild(currentRoom, currentShard)
              return
            }

            // view mode: clear any pending marker
            clearPendingTile()
            r.hoverLayer.clearPendingTile()

            if (!objLayer) return
            const hits = objLayer.getObjectsAtTile(tx, ty)

            if (hits.length === 0) {
              if (!ctrlKey) {
                setSelection([])
                r.hoverLayer.clearSelection()
              }
              return
            }

            let nextSelection = [...selection()]

            if (ctrlKey) {
              // Ctrl+Click: if ANY object on the tile is already selected → deselect
              // those objects only; otherwise add all objects on the tile.
              const hitIds = new Set(hits.map(h => h.id))
              const hasSelected = nextSelection.some(s => hitIds.has(s.id))

              if (hasSelected) {
                // Deselect the objects on this tile
                nextSelection = nextSelection.filter(s => !hitIds.has(s.id))
              } else {
                // Add all objects on this tile
                const toAdd = hits
                    .filter(({ id }) => !nextSelection.some(s => s.id === id))
                    .map(({ id, obj }) => createSelectedObject(id, obj))
                nextSelection = [...nextSelection, ...toAdd]
              }
            } else {
              // Normal click: replace selection with objects on this tile
              nextSelection = hits.map(({ id, obj }) => createSelectedObject(id, obj))
            }

            setSelection(nextSelection)

            // Rebuild visual overlays from the full new selection
            const visuals = nextSelection
                .map(({ id, type }) => ({
                  id,
                  type,
                  visual: objLayer!.getVisualById(id)!,
                }))
                .filter(v => v.visual != null)
            r.hoverLayer.setSelectedObjects(visuals)
          },
          () => {
            const mode = roomViewMode()
            if (mode === 'build' || mode === 'flag' || overlayAction()?.type === 'moveFlag') {
              resetRoomViewMode()
              r.hoverLayer.clearPendingTile()
            }
          },
      )
    }

    if (diff) {
      updateSelectionWithDiff(diff, objs)
    } else {
      updateSelectionFromObjects(objs)
    }

    // Drive timings off a single base tick duration so motion + action beams + say bubbles stay in sync.
    const tickMs = historyMode()
      ? Math.round(1000 / untrack(playbackSpeed))
      : (tickDuration() ?? 2000)
    const beamDuration = tickMs * 0.6           // action animations (harvest / build / upgrade beam)
    const moveDuration = Math.round(tickMs * 0.9)  // creep motion — fills most of a tick

    objLayer.setMoveDuration(moveDuration)
    lastRawState = { objects: objs, users }
    objLayer.update(objs, diff, users, gameTime() ?? undefined)
    objLayer.setShowLabels(untrack(showCreepLabels))

    const sayingIds = new Set<string>()
    if (animLayer) {
      animLayer.clear()
      // Use for...in over Object.entries to avoid allocating a new array of arrays every tick
      for (const id in objs) {
        const obj = objs[id]
        if (!obj || obj.type !== 'creep') continue
        const actionLog = obj.actionLog as Record<string, unknown> | null | undefined
        if (!actionLog) continue

        const harvest = actionLog.harvest as { x: number; y: number } | null | undefined
        if (harvest) {
          animLayer.addHarvest(harvest.x, harvest.y, obj.x, obj.y, beamDuration)
        }
        const upgrade = actionLog.upgradeController as { x: number; y: number } | null | undefined
        if (upgrade) {
          animLayer.addUpgradeController(obj.x, obj.y, upgrade.x, upgrade.y, beamDuration)
        }
        const build = actionLog.build as { x: number; y: number } | null | undefined
        if (build) {
          animLayer.addBuild(obj.x, obj.y, build.x, build.y, beamDuration)
          objLayer?.triggerBuildAt(build.x, build.y, beamDuration)
        }
        const say = actionLog.say as { message?: unknown } | null | undefined
        if (say && typeof say.message === 'string' && say.message.length > 0) {
          objLayer?.triggerSay(id, say.message)
          sayingIds.add(id)
        }
      }
    }
    objLayer.pruneSayBubblesExcept(sayingIds)
  })

  // Update RoomVisuals overlay each tick (layer is created in the objects effect).
  // Read visualState() before the optional chain so SolidJS always tracks it,
  // even when visualLayer hasn't been created yet.
  createEffect(() => {
    const raw = visualState()
    visualLayer?.update(showRoomVisuals() ? raw : '')
  })

  // Sync instant-mode when entering/leaving history mode
  createEffect(() => {
    objLayer?.setInstantMode(historyMode())
  })


  // Sync terrain effects visibility when the setting changes
  createEffect(() => {
    const enabled = terrainEffects()
    if (terrainLayerRef) setTerrainEffectsVisible(terrainLayerRef, enabled)
  })

  // Rebuild object layer when sprite theme changes
  createEffect(() => {
    const theme = resolveTheme(spriteTheme())
    if (!objLayer) return
    objLayer.setTheme(theme, sharedAtlasCache)
    if (lastRawState) {
      objLayer.clear()
      objLayer.update(lastRawState.objects, undefined, lastRawState.users)
    }
  })

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={(el) => containerRef = el} style={{ width: '100%', height: '100%' }} />
      {modeHint() && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            'border-radius': '6px',
            background: 'rgba(13, 17, 23, 0.65)',
            border: '1px solid rgba(48, 54, 61, 0.6)',
            'font-size': '13px',
            'font-weight': 500,
            color: '#c9d1d9',
            'pointer-events': (worldStatus() === 'empty' || worldStatus() === 'lost') ? 'auto' : 'none',
            'user-select': 'none',
            'z-index': 10,
          }}
        >
          {modeHint()}
        </div>
      )}
      {!historyMode() && gameTime() !== null && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 10px',
            'border-radius': '4px',
            background: 'rgba(13, 17, 23, 0.8)',
            border: '1px solid #30363d',
            'font-size': '12px',
            color: '#8b949e',
            'z-index': 10,
          }}
        >
          Tick {gameTime()}
        </div>
      )}
      <Show when={historyMode()}>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'rgba(13, 17, 23, 0.85)',
            'border-top': '1px solid #30363d',
            'z-index': 10,
          }}
        >
          <input
            type="range"
            min={historyMinTick()}
            max={historyMaxTick()}
            value={sliderValue()}
            step={1}
            onInput={(e) => {
              const v = parseInt(e.currentTarget.value, 10)
              setSliderValue(v)
              if (seekDebounceTimer !== null) clearTimeout(seekDebounceTimer)
              seekDebounceTimer = setTimeout(() => {
                seekDebounceTimer = null
                seekToTick(v)
              }, 150)
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div
            style={{
              display: 'flex',
              'justify-content': 'space-between',
              'font-size': '10px',
              color: '#8b949e',
              'margin-top': '2px',
            }}
          >
            <span>{historyMinTick()}</span>
            <span style={{ color: historyLoading() ? '#f0883e' : '#8b949e' }}>
              {historyLoading() ? 'Loading…' : `Tick ${historyTick()}`}
            </span>
            <span>{historyMaxTick()}</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
