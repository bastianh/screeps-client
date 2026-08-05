import { batch, createEffect, createMemo, createSignal, onCleanup, onMount, untrack, Show } from 'solid-js'
import { RoomRenderer, TILE_SIZE, Z } from '~/renderer/RoomRenderer.js'
import { createTerrainLayer, setTerrainEffectsVisible } from '~/renderer/TerrainLayer.js'
import { parseRoomDecorations, mergeDecorationItems, type RoomDecoration } from '~/renderer/roomDecorations.js'
import { DecorationLayer } from '~/renderer/DecorationLayer.js'
import { OBJ_ROAD, ST_DARK } from '~/renderer/colors.js'
import { ObjectLayer } from '~/renderer/ObjectLayer.js'
import { ActionAnimationLayer } from '~/renderer/ActionAnimationLayer.js'
import { VisualLayer } from '~/renderer/VisualLayer.js'
import { client, gameTime, setGameTime, recordGameTime, tickDuration, worldBounds, userInfo, worldStatus, serverVersion, isPrivateServer } from '~/stores/clientStore.js'
import { showCreepLabels, terrainEffects, showRoomVisuals, showRoomDecorations, roomDarkOverlay, smoothAnimations } from '~/stores/settingsStore.js'
import { setSelection, clearSelection, selection, updateSelectionWithDiff, updateSelectionFromObjects, createSelectedObject } from '~/stores/selectionStore.js'
import { addToast } from '~/stores/toastStore.js'
import { setRoomObjectCount, setRoomOwner, setControllerLevel, setControllerProgress, setControllerReservation, setStructureCounts, setRoomUsers, roomUsers, setCurrentShard, setCurrentRoom, setRoomDecorationItems, decorationsRevision } from '~/stores/roomDataStore.js'
import {
  decorateHint, decorationDraft, decorationPreviewItem, draftBounds, draftCapabilities,
  draftHasFrame, draftPlacement, setDraftPlacement,
} from '~/stores/decorationEditStore.js'
import { PlacementFrame } from '~/components/inventory/PlacementFrame.js'
import { AMBER } from '~/components/theme.js'
import { parseRoomName, formatRoomName, isRoomInWorld } from '~/utils/roomName.js'
import { useRoomNavigationKeys } from '~/utils/useRoomNavigationKeys.js'
import type { ApiRoomDecorationItem, Badge, RoomTerrain, RoomObjectMap, RoomObjectDiff } from 'screeps-connectivity'
import { SubscriptionGroup } from 'screeps-connectivity'
import { historyMode, historyTick, historyMinTick, historyMaxTick, setHistoryMaxTick, historyLoading, setHistoryLoading, seekToTick, playbackSpeed, isPlaying, pausePlayback } from '~/stores/historyStore.js'
import { HistoryPlayer, HistoryUnavailableError } from '~/stores/HistoryPlayer.js'
import {flagDraft, roomViewMode, FLAG_COLOR_MAP, pendingTile, setPendingTile, clearPendingTile, setFlagDraft, modeHint, overlayAction, setOverlayAction, clearOverlayAction, buildDraft, confirmBuild, resetRoomViewMode, resetRoomViewModeOnNavigate} from '~/stores/roomViewStore';
import { createLogger } from '~/utils/log.js'

const { log, error } = createLogger('room')

// After creating a flag the server needs a moment to register it, so an
// immediate gen-unique-flag-name can still return the name we just used.
// Retry with a short backoff until we get a different name (or give up).
function regenerateUniqueFlagName(
  c: NonNullable<ReturnType<typeof client>>,
  usedName: string,
  shard: string | null,
  retries = 4,
): void {
  c.http.game.genUniqueFlagName(shard)
    .then((res) => {
      if (res.name === usedName && retries > 0) {
        setTimeout(() => regenerateUniqueFlagName(c, usedName, shard, retries - 1), 200)
        return
      }
      setFlagDraft((prev) => ({ ...prev, name: res.name }))
    })
    .catch((err) => error('gen unique flag name failed:', err))
}

/** Decorate mode's hint, which depends on the draft rather than the mode alone. */
function DecorateHint() {
  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'text-align': 'center' }}>
      <span>{decorateHint().primary}</span>
      <Show when={decorateHint().note}>
        {(note) => <span style={{ color: AMBER }}>{note()}</span>}
      </Show>
      <span style={{ opacity: '0.6', 'font-size': '0.9em' }}>{decorateHint().secondary}</span>
    </div>
  )
}

interface RoomViewerProps {
  room: string
  shard: string | null
  onNavigate?: (room: string, shard: string | null) => void
}

export function RoomViewer(props: RoomViewerProps) {
  let containerRef: HTMLDivElement | undefined
  // The renderer signal is still null while PixiJS initialises, so onCleanup cannot
  // reach an Application whose create() resolves after unmount — this flag lets
  // onMount destroy it instead of leaking a WebGL context.
  let disposed = false
  let objLayer: ObjectLayer | null = null
  let animLayer: ActionAnimationLayer | null = null
  let visualLayer: VisualLayer | null = null
  let terrainLayerRef: ReturnType<typeof createTerrainLayer> | null = null
  let decorationLayerRef: DecorationLayer | null = null
  const [renderer, setRenderer] = createSignal<RoomRenderer | null>(null)
  const [terrain, setTerrain] = createSignal<{ room: string, data: RoomTerrain } | null>(null)
  // Raw items are kept so socket updates can be merged into them by `_id`; the parsed
  // form every layer consumes is derived from that.
  const [decorationItems, setDecorationItems] = createSignal<{ room: string; items: readonly ApiRoomDecorationItem[] } | null>(null)
  // Items that arrived over the socket while an HTTP read was in flight. Only those are
  // layered back on top of the response — carrying every earlier socket item over would
  // keep a decoration that has since been taken down alive until the next room change.
  let socketItemsSinceFetch: ApiRoomDecorationItem[] = []
  // The draft changes on every pointer move, but its geometry is pinned, so most of those
  // changes are no-ops here. Comparing by content keeps the decoration memo — and with it
  // the layer rebuild — off the drag path entirely.
  const decorationPreview = createMemo(decorationPreviewItem, undefined, {
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  })
  const roomDecoration = createMemo<{ room: string; decoration: RoomDecoration } | null>(() => {
    const raw = decorationItems()
    if (!raw) return null
    // While a decoration is being edited in this room, the draft stands in for the stored
    // item — that is what makes a colour or animation change show up live. Its geometry
    // is pinned (see `decorationPreviewItem`) and pushed to the layer separately.
    const preview = raw.room === props.room ? decorationPreview() : null
    const items = preview ? mergeDecorationItems(raw.items, [preview]) : raw.items
    return { room: raw.room, decoration: parseRoomDecorations(items) }
  })
  // Publish the raw items for the sidebar and the creep properties panel.
  createEffect(() => {
    const raw = decorationItems()
    setRoomDecorationItems(raw?.room === props.room ? raw.items : [])
  })
  const [objectState, setObjectState] = createSignal<{ objects: RoomObjectMap, diff?: RoomObjectDiff, users?: Record<string, { _id: string; username: string; badge?: Badge }> } | null>(null)
  const [visualState, setVisualState] = createSignal<string>('')
  // Set when the current history tick has no data on the server (404). Shows a
  // "no data" hint over the room instead of a failure toast.
  const [historyNoData, setHistoryNoData] = createSignal(false)
  const [sliderValue, setSliderValue] = createSignal(historyTick())
  createEffect(() => setSliderValue(historyTick()))

  let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null

  onMount(async () => {
    if (!containerRef) return
    const r = await RoomRenderer.create(containerRef)
    if (disposed) {
      r.destroy()
      return
    }
    setRenderer(r)
  })

  onCleanup(() => {
    disposed = true
    if (seekDebounceTimer !== null) clearTimeout(seekDebounceTimer)
    objLayer?.destroy()
    objLayer = null
    animLayer?.destroy()
    animLayer = null
    visualLayer?.destroy()
    visualLayer = null
    decorationLayerRef?.destroy()
    decorationLayerRef = null
    const r = renderer()
    if (r) r.destroy()
  })

  // Load terrain + decorations independently of history mode. Terrain is always needed,
  // and gating it on !historyMode() breaks a fresh page reload straight into history mode
  // (URL carries #tick=...): entering history mode would otherwise cancel the in-flight
  // terrain fetch before it resolves, leaving the room without terrain.
  createEffect(() => {
    const c = client()
    if (!c) return

    const room = props.room
    const shard = props.shard

    setTerrain(null)
    setDecorationItems(null)
    setCurrentRoom(room)
    setCurrentShard(shard)

    let cancelled = false
    c.stores.room.terrain(room, shard)
      .then((t) => {
        if (!cancelled) {
          log(`terrain loaded — ${room}`)
          setTerrain({ room, data: t })
        }
      })
      .catch((err) => { if (!cancelled) error(`terrain load failed for ${room}:`, err) })

    onCleanup(() => { cancelled = true })
  })

  // Decorations are fetched in their own effect so that switching the setting back on
  // re-fetches immediately instead of waiting for the next room change.
  createEffect(() => {
    const c = client()
    if (!c || !showRoomDecorations()) return

    const room = props.room
    const shard = props.shard
    // Re-read after this client placed or removed a decoration. The room socket only
    // carries decorations when the server volunteers them, so an activation made from
    // the inventory would otherwise stay invisible until the room was reloaded.
    void decorationsRevision()

    let cancelled = false
    socketItemsSinceFetch = []
    c.http.game.roomDecorations(room, shard)
      .then((resp) => {
        if (!cancelled) {
          log(`decorations loaded — ${room}: ${resp.decorations.length} item(s)`)
          // The response is authoritative, so removals take effect; a room tick that
          // landed while it was in flight is layered back on top rather than dropped.
          const items = mergeDecorationItems(resp.decorations, socketItemsSinceFetch)
          socketItemsSinceFetch = []
          setDecorationItems({ room, items })
        }
      })
      .catch((err) => { if (!cancelled) log(`no decorations for ${room}: ${err}`) })

    onCleanup(() => { cancelled = true })
  })

  // Room ticks can carry decoration changes. Merge them into whatever the HTTP fetch
  // returned; the merge keeps the previous array when nothing actually differs, so a
  // server that repeats the payload every tick doesn't rebuild the layer.
  createEffect(() => {
    const c = client()
    if (!c || !showRoomDecorations()) return

    const room = props.room
    const shard = props.shard

    const sub = c.stores.room.on('room:decorations', (data) => {
      if (data.room !== room || data.shard !== shard) return
      socketItemsSinceFetch.push(...data.decorations)
      setDecorationItems((prev) => {
        const current = prev?.room === room ? prev.items : []
        const merged = mergeDecorationItems(current, data.decorations)
        if (prev?.room === room && merged === current) return prev
        log(`decorations updated via socket — ${room}: ${merged.length} item(s)`)
        return { room, items: merged }
      })
    })

    onCleanup(() => sub.dispose())
  })

  // Subscribe to room data as soon as client is ready (no renderer dependency to avoid
  // a race where PixiJS init finishes after the initial room state arrives)
  createEffect(() => {
    const c = client()
    if (!c || historyMode()) return

    const room = props.room
    const shard = props.shard

    log(`navigate → ${room} (shard=${shard ?? 'default'})`)
    batch(() => {
      setObjectState(null)
      setVisualState('')
      setGameTime(null)
      clearSelection()
      setRoomObjectCount(null)
      setRoomOwner(null)
      setControllerLevel(null)
      setControllerProgress(null)
      setControllerReservation(null)
      setStructureCounts({})
      setRoomUsers(null)
    })

    const group = new SubscriptionGroup()

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
      let reservation: { user: string; endTime: number } | null = null

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

        if (objType === 'controller') {
          if (typeof obj.user === 'string') {
            const userId = obj.user
            const username = data.users?.[userId]?.username ?? userId
            owner = { userId, username }
            if (typeof obj.level === 'number') ctrlLevel = obj.level
            if (typeof obj.progress === 'number') ctrlProgress = obj.progress
          }
          const res = obj.reservation as { user: string; endTime: number } | undefined
          if (res && typeof res.user === 'string' && typeof res.endTime === 'number') {
            reservation = { user: res.user, endTime: res.endTime }
          }
        }
      }

      if (!data.diff) {
        log(`objects loaded — ${room}: ${objectCount} objects, tick=${data.gameTime}`)
      }
      // One batch per tick: the render effect tracks several of these signals and must
      // run once per update, not once per setter.
      batch(() => {
        setObjectState({ objects: data.objects, diff: data.diff, users: data.users })
        setVisualState(data.visual)
        setGameTime(data.gameTime ?? null)
        recordGameTime(data.gameTime)
        setRoomObjectCount(objectCount)
        setRoomOwner(owner)
        setControllerLevel(ctrlLevel || null)
        setControllerProgress(ctrlProgress)
        setControllerReservation(reservation)
        setStructureCounts(structCounts)
        setRoomUsers(data.users ?? null)
      })
    }))

    onCleanup(() => {
      log(`leaving ${room}`)
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

    const player = new HistoryPlayer(room, shard, c.http, chunkSize)

    createEffect(() => {
      const tick = historyTick()
      let cancelled = false
      setHistoryLoading(true)

      player.getStateAtTick(tick)
        .then((state) => {
          if (cancelled) return
          setHistoryLoading(false)
          setHistoryNoData(false)
          // If the requested chunk didn't exist yet, clamp the history range down
          if (state.clampedTo !== undefined) {
            setHistoryMaxTick(state.clampedTo)
            seekToTick(state.clampedTo)
            return
          }
          let objectCount = 0
          const structCounts: Record<string, number> = {}
          let ctrlLevel = 0
          let ctrlProgress: number | null = null
          let owner: { userId: string; username: string } | null = null
          let reservation: { user: string; endTime: number } | null = null

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
            if (objType === 'controller') {
              if (typeof obj.user === 'string') {
                const userId = obj.user
                const username = cachedUsers?.[userId]?.username ?? userId
                owner = { userId, username }
                if (typeof obj.level === 'number') ctrlLevel = obj.level
                if (typeof obj.progress === 'number') ctrlProgress = obj.progress
              }
              const res = obj.reservation as { user: string; endTime: number } | undefined
              if (res && typeof res.user === 'string' && typeof res.endTime === 'number') {
                reservation = { user: res.user, endTime: res.endTime }
              }
            }
          }

          // Mirrors the live path: one batch per tick so the render effect runs once.
          batch(() => {
            setObjectState({ objects: state.objects, diff: undefined, users: cachedUsers })
            setGameTime(state.gameTime)
            setRoomObjectCount(objectCount)
            setRoomOwner(owner)
            setControllerLevel(ctrlLevel || null)
            setControllerProgress(ctrlProgress)
            setControllerReservation(reservation)
            setStructureCounts(structCounts)
          })
        })
        .catch((err: Error) => {
          if (cancelled) return
          setHistoryLoading(false)
          // No data for this tick (404): show an in-room hint instead of a failure toast.
          if (err instanceof HistoryUnavailableError) {
            setHistoryNoData(true)
            // While playing, don't re-fetch the same missing chunk file on every tick —
            // skip to the start of the next chunk in one hop. Stop if there's none left.
            if (isPlaying()) {
              const nextBase = player.chunkBase(tick) + chunkSize
              if (nextBase <= historyMaxTick()) {
                seekToTick(nextBase)
              } else {
                pausePlayback()
              }
            }
            return
          }
          setHistoryNoData(false)
          addToast(`History load failed for tick ${tick}: ${err.message}`, 'error', 5000)
        })

      onCleanup(() => { cancelled = true })
    })

    // Reset the "no data" hint when leaving history mode / changing room.
    onCleanup(() => setHistoryNoData(false))
  })

  // Shared by the clear-effect (room change) and the worldBounds effect below, so the
  // arrow zones always reflect both the current room and the known world bounds.
  const wireNavZones = (
    r: RoomRenderer,
    room: string,
    shard: string | null,
    nav: RoomViewerProps['onNavigate'],
    bounds: ReturnType<typeof worldBounds>,
  ): void => {
    const coord = parseRoomName(room)
    if (!coord || !nav) return

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
      const dec = untrack(roomDecoration)
      terrainLayerRef = createTerrainLayer(t.data, r.app.renderer, dec?.room === props.room ? dec.decoration.terrain : undefined)
      setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
      terrainLayerRef.zIndex = Z.terrain
      r.world.addChild(terrainLayerRef)    }

    // Re-create navigation zones immediately after clear so arrows are never missing
    // after a room change. worldBounds/onNavigate are untracked so this effect only runs
    // when room/shard/renderer changes (matching the clear trigger).
    wireNavZones(r, props.room, props.shard, untrack(() => props.onNavigate), untrack(worldBounds))
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
    const nav = props.onNavigate
    if (!nav || !parseRoomName(room)) return

    useRoomNavigationKeys({
      currentRoom: () => props.room,
      worldBounds,
      onMove: (rx, ry) => {
        log(`navigate requested: ${props.room} → ${formatRoomName(rx, ry)}`)
        nav(formatRoomName(rx, ry), shard)
      },
    })

    wireNavZones(r, room, shard, nav, worldBounds())
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
    const dec = untrack(roomDecoration)
    terrainLayerRef = createTerrainLayer(t.data, r.app.renderer, dec?.room === props.room ? dec.decoration.terrain : undefined)
    setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
    r.world.addChildAt(terrainLayerRef, 0)
  })

  // Clear decorations when the setting is turned off
  createEffect(() => {
    if (showRoomDecorations()) return
    setDecorationItems(null)
    const r = untrack(renderer)
    const t = untrack(terrain)
    if (!r || !t || t.room !== props.room) return
    if (!terrainLayerRef?.parent) return
    terrainLayerRef.destroy()
    terrainLayerRef = createTerrainLayer(t.data, r.app.renderer)
    setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
    r.world.addChildAt(terrainLayerRef, 0)
    objLayer?.setRoadColor(OBJ_ROAD)
    objLayer?.setWallColor(ST_DARK)
    objLayer?.setDecorations([], [])
  })

  // Re-apply terrain colors when decoration arrives after terrain (common async case)
  createEffect(() => {
    const r = renderer()
    const dec = roomDecoration()
    const t = untrack(terrain)
    if (!r || !dec || dec.room !== props.room) return
    if (!t || t.room !== props.room) return
    if (!terrainLayerRef?.parent) return

    log(`decoration arrived, rebuilding terrain layer — ${props.room}`)
    terrainLayerRef.destroy()
    terrainLayerRef = createTerrainLayer(t.data, r.app.renderer, dec.decoration.terrain)
    setTerrainEffectsVisible(terrainLayerRef, untrack(terrainEffects))
    r.world.addChildAt(terrainLayerRef, 0)
    if (objLayer && dec.decoration.roadColor != null) {
      objLayer.setRoadColor(dec.decoration.roadColor)
    }
    if (objLayer && dec.decoration.terrain?.wallFillColor != null) {
      objLayer.setWallColor(dec.decoration.terrain.wallFillColor)
    }
    // Creep and object overlays hang off the individual object visuals, so the
    // ObjectLayer owns them rather than a layer of our own.
    objLayer?.setDecorations(dec.decoration.creeps, dec.decoration.objects)
  })

  // Graffiti overlay. Rebuilt whenever the decorations or the terrain change — the
  // layer masks itself against the terrain, so it needs both.
  createEffect(() => {
    const r = renderer()
    const dec = roomDecoration()
    const t = terrain()

    decorationLayerRef?.destroy()
    decorationLayerRef = null

    if (!r || !t || t.room !== props.room) return
    if (!dec || dec.room !== props.room || dec.decoration.graffiti.length === 0) return

    log(`graffiti — ${props.room}: ${dec.decoration.graffiti.length} item(s)`)
    decorationLayerRef = new DecorationLayer(dec.decoration.graffiti, t.data, r.app.ticker)
    r.world.addChild(decorationLayerRef.base)

    // A rebuild — a colour edit, a tick carrying decorations — starts from the stored
    // placement, so an in-progress drag has to be put back on top of it.
    const draft = untrack(decorationDraft)
    const placement = untrack(draftPlacement)
    if (draft && placement) decorationLayerRef.setTransform(draft.id, placement)
  })

  // ── In-room decoration editing ──────────────────────────────────────────────────
  // The frame and its handles are HTML drawn over the canvas, so they need the world
  // transform to be readable and to hold still. Locking the camera gives both, and a
  // fully zoomed-out room is what makes a decoration reachable without panning.
  const [viewTransform, setViewTransform] = createSignal({ x: 0, y: 0, scale: 1 })
  // A plain boolean, so a drag — which replaces the draft on every pointer move — does
  // not re-run the camera wiring underneath it. The camera parks as soon as the mode is
  // entered, before anything is picked: choosing what to place means looking at the room.
  const decorating = createMemo(() => roomViewMode() === 'decorate')

  createEffect(() => {
    const r = renderer()
    if (!r) return

    const editing = decorating()
    r.setCameraLocked(editing)
    if (!editing) {
      r.setViewChangeHandler(null)
      return
    }

    const sync = () => setViewTransform(r.viewTransform)
    r.setViewChangeHandler(sync)
    sync()
    onCleanup(() => r.setViewChangeHandler(null))
  })

  const hint = () => roomViewMode() === 'decorate' ? <DecorateHint /> : modeHint()

  // Dragging never rebuilds the decoration layer: the placement goes straight to the
  // sprites, so the wall-masked artwork follows the frame at pointer speed.
  createEffect(() => {
    const draft = decorationDraft()
    const placement = draftPlacement()
    if (!decorationLayerRef || !draft || !placement) return
    decorationLayerRef.setTransform(draft.id, placement)
  })

  // Render objects when they update
  createEffect(() => {
    const r = renderer()
    const state = objectState()
    if (!r) return
    if (!state) {
      objLayer?.clear()
      animLayer?.clear()
      r.clearLighting()
      return
    }

    const { objects: objs, diff, users } = state

    // A freshly-created ObjectLayer must reconcile against the FULL object map, not the
    // latest tick's diff. The room subscription starts before the renderer exists (see
    // the subscribe effect above), so on a fresh mount — e.g. opening a room from the
    // world map — room:update messages land in objectState() before objLayer is created.
    // objectState() keeps only the latest message, so the initial full snapshot can be
    // overwritten by a later small diff. data.objects is always the complete map, so
    // treat the first update as a full reconcile (diff=undefined) to rebuild the scene.
    const isFirstUpdate = !objLayer
    const effectiveDiff = isFirstUpdate ? undefined : diff

    if (!objLayer) {
      log(`object layer created — ${props.room}`)
      objLayer = new ObjectLayer(r.app.ticker, showCreepLabels(), userInfo()?._id, userInfo()?.badge, users)
      objLayer.setInstantMode(untrack(historyMode) || !untrack(smoothAnimations))
      const dec = untrack(roomDecoration)
      if (dec?.room === props.room) {
        if (dec.decoration.roadColor != null) objLayer.setRoadColor(dec.decoration.roadColor)
        if (dec.decoration.terrain?.wallFillColor != null) objLayer.setWallColor(dec.decoration.terrain.wallFillColor)
        objLayer.setDecorations(dec.decoration.creeps, dec.decoration.objects)
      }
      objLayer.setLightingLayer(r.lighting)
      objLayer.container.label = 'objects'
      objLayer.container.zIndex = Z.objects
      r.world.addChild(objLayer.container)

      animLayer = new ActionAnimationLayer(r.app.ticker)
      animLayer.container.label = 'animations'
      animLayer.container.zIndex = Z.animations
      r.world.addChild(animLayer.container)

      visualLayer = new VisualLayer(r.app.renderer, r.world, r.app.ticker)
      visualLayer.container.zIndex = Z.visuals
      r.world.addChild(visualLayer.container)

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

            // Decorate mode owns the canvas: the frame handles the gesture, and a click
            // beside it must not start changing the selection behind the editor.
            if (mode === 'decorate') return

            const overlay = overlayAction()

            if (overlay?.type === 'moveFlag') {
              const c = client()
              if (!c) return

              const { name, room: flagRoom, x: fromX, y: fromY, color, secondaryColor, targetRoom } = overlay
              c.http.game.removeFlag(flagRoom, name, currentShard ?? undefined)
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
                  clearOverlayAction()
                  // The remove may already have gone through — recreate the flag on its
                  // old tile so a half-failed move never silently deletes it. Creating a
                  // flag under its existing name just re-places it, so this is also safe
                  // when the remove itself was what failed.
                  c.http.game.createFlag(flagRoom, fromX, fromY, name, color, secondaryColor, currentShard ?? undefined)
                    .then(() => addToast(`Failed to move flag "${name}" — restored at its previous position`, 'error'))
                    .catch(() => addToast(`Failed to move flag "${name}" and could not restore it`, 'error'))
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
                    regenerateUniqueFlagName(c, name, currentShard)
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
              if (!ctrlKey) setSelection([])
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

            // The selection-sync effect below rebuilds the canvas overlays from this.
            setSelection(nextSelection)
          },
          () => {
            const mode = roomViewMode()
            if (mode === 'build' || mode === 'flag' || mode === 'decorate' || overlayAction()?.type === 'moveFlag') {
              resetRoomViewMode()
              r.hoverLayer.clearPendingTile()
            }
          },
      )
    }

    if (effectiveDiff) {
      updateSelectionWithDiff(effectiveDiff, objs)
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
    objLayer.setTickDuration(tickMs)
    objLayer.update(objs, effectiveDiff, users, gameTime() ?? undefined)
    objLayer.setShowLabels(untrack(showCreepLabels))

    const sayingIds = new Set<string>()
    if (animLayer) {
      animLayer.clear()
      // Use for...in over Object.entries to avoid allocating a new array of arrays every tick
      for (const id in objs) {
        const obj = objs[id]
        if (!obj) continue
        const actionLog = obj.actionLog as Record<string, unknown> | null | undefined
        if (!actionLog) continue

        if (obj.type === 'tower') {
          const attack = actionLog.attack as { x: number; y: number } | null | undefined
          const heal = actionLog.heal as { x: number; y: number } | null | undefined
          const repair = actionLog.repair as { x: number; y: number } | null | undefined
          if (attack) animLayer.addTowerAttack(obj.x, obj.y, attack.x, attack.y, beamDuration)
          if (heal) animLayer.addTowerHeal(obj.x, obj.y, heal.x, heal.y, beamDuration)
          if (repair) animLayer.addTowerRepair(obj.x, obj.y, repair.x, repair.y, beamDuration)
          // Aim the barrel at whichever action fired this tick (one action per tick).
          const aim = attack ?? heal ?? repair
          if (aim) objLayer?.triggerTowerAim(id, aim.x, aim.y, beamDuration)
          continue
        }

        if (obj.type === 'link') {
          // Source link records the destination position in actionLog.transferEnergy; the
          // receiving link gets no entry, so this fires exactly once per transfer.
          const linkTransfer = actionLog.transferEnergy as { x: number; y: number } | null | undefined
          if (linkTransfer) animLayer.addLinkTransfer(obj.x, obj.y, linkTransfer.x, linkTransfer.y, beamDuration)
          continue
        }

        if (obj.type === 'lab') {
          // The producing lab logs both input-lab positions as {x1,y1,x2,y2}; fire one beam
          // per input so both streams converge on this (the output) lab. reverseReaction is
          // the same shape for the unreaction. Only the producing lab carries the entry, so
          // each reaction animates exactly once.
          const reaction = (actionLog.runReaction ?? actionLog.reverseReaction) as
            { x1: number; y1: number; x2: number; y2: number } | null | undefined
          if (reaction) {
            animLayer.addLabReaction(reaction.x1, reaction.y1, obj.x, obj.y, beamDuration)
            animLayer.addLabReaction(reaction.x2, reaction.y2, obj.x, obj.y, beamDuration)
          }
          continue
        }

        if (obj.type !== 'creep') continue

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
        const repair = actionLog.repair as { x: number; y: number } | null | undefined
        if (repair) {
          animLayer.addRepair(obj.x, obj.y, repair.x, repair.y, beamDuration)
        }
        const transfer = actionLog.transfer as { x: number; y: number } | null | undefined
        if (transfer) {
          animLayer.addTransfer(obj.x, obj.y, transfer.x, transfer.y, beamDuration)
        }
        const say = actionLog.say as { message?: unknown; isPublic?: boolean } | null | undefined
        if (say && typeof say.message === 'string' && say.message.length > 0) {
          // Non-public sayings are only visible to the creep's owner. The server may still
          // deliver them (private-server mods don't always filter), so guard here.
          const myId = userInfo()?._id
          const visible = say.isPublic === true || (myId != null && obj.user === myId)
          if (visible) {
            objLayer?.triggerSay(id, say.message)
            sayingIds.add(id)
          }
        }
      }
    }
    objLayer.pruneSayBubblesExcept(sayingIds)
    if (untrack(roomDarkOverlay)) r.updateLighting(objs)
  })

  // Keep the canvas selection overlays in sync with the selection store. Objects can
  // leave the selection outside the canvas click handler — a selected creep dying in a
  // diff, a deselect from the sidebar — and the ring/box has to go with them.
  createEffect(() => {
    const r = renderer()
    const sel = selection()
    if (!r) return
    const layer = objLayer
    if (!layer) {
      r.hoverLayer.clearSelection()
      return
    }
    const visuals = sel.flatMap(({ id, type }) => {
      const visual = layer.getVisualById(id)
      return visual ? [{ id, type, visual }] : []
    })
    r.hoverLayer.setSelectedObjects(visuals)
  })

  // Update RoomVisuals overlay each tick (layer is created in the objects effect).
  // Read visualState() before the optional chain so SolidJS always tracks it,
  // even when visualLayer hasn't been created yet.
  createEffect(() => {
    const raw = visualState()
    visualLayer?.update(showRoomVisuals() ? raw : '')
  })

  // Sync instant-mode when entering/leaving history mode, or when the user toggles
  // the "smooth animations" setting. Both force tick-driven animations to snap.
  createEffect(() => {
    objLayer?.setInstantMode(historyMode() || !smoothAnimations())
  })


  // Sync terrain effects visibility when the setting changes
  createEffect(() => {
    const enabled = terrainEffects()
    if (terrainLayerRef) setTerrainEffectsVisible(terrainLayerRef, enabled)
  })

  // Sync dark overlay + light layer visibility
  createEffect(() => {
    const r = renderer()
    if (!r) return
    const enabled = roomDarkOverlay()
    r.darkOverlay.visible = enabled
    r.lightLayer.visible = enabled
    if (!enabled) {
      r.clearLighting()
    } else {
      // Rebuild the lightmap from the current objects right away — waiting for the
      // next room:update would leave the room uniformly dark for up to a full tick.
      const state = untrack(objectState)
      if (state) r.updateLighting(state.objects)
    }
  })

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={(el) => containerRef = el} style={{ width: '100%', height: '100%' }} />
      <Show when={roomViewMode() === 'decorate' && draftHasFrame() ? draftPlacement() : null}>
        {(placement) => (
          <div style={{ position: 'absolute', inset: '0', 'pointer-events': 'none', 'z-index': 9 }}>
            <PlacementFrame
              placement={placement()}
              capabilities={draftCapabilities()!}
              bounds={draftBounds()!}
              cellSize={TILE_SIZE * viewTransform().scale}
              originX={viewTransform().x}
              originY={viewTransform().y}
              // The real, wall-masked artwork is already rendering underneath; this is
              // the ghost that shows where the image sits when it falls off the walls.
              previewUrl={decorationDraft()?.decoration.preview?.['256x256'] ?? decorationDraft()?.decoration.preview?.original}
              previewOpacity={0.3}
              onChange={setDraftPlacement}
            />
          </div>
        )}
      </Show>
      {hint() && (
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
          {hint()}
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
      <Show when={historyMode() && historyNoData()}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 22px',
            'border-radius': '8px',
            background: 'rgba(13, 17, 23, 0.9)',
            border: '1px solid #30363d',
            'text-align': 'center',
            'max-width': '320px',
            'pointer-events': 'none',
            'user-select': 'none',
            'z-index': 11,
          }}
        >
          <div style={{ 'font-size': '14px', 'font-weight': 600, color: '#c9d1d9', 'margin-bottom': '4px' }}>
            No data available for this tick
          </div>
          <div style={{ 'font-size': '12px', color: '#8b949e' }}>
            Use the timeline below to choose another tick.
          </div>
        </div>
      </Show>
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
