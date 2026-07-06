import { createEffect, createSignal, lazy, onCleanup, onMount, Show, untrack, type JSX } from 'solid-js'
import { Map, Code2, Settings, LogIn, LayoutDashboard, Store, Clock } from 'lucide-solid'
import { ConnectionStatus } from '~/components/ConnectionStatus.js'
import { RoomViewer } from '~/components/RoomViewer.js'
import { ToastContainer } from '~/components/ToastContainer.js'
import type { RoomInfo } from '~/components/MapViewer.js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { Sidebar } from '~/components/Sidebar/index.js'
import { StatsBar } from '~/components/StatsBar.js'
import { SettingsPanel } from '~/components/SettingsPanel.js'
import { MotdOverlay } from '~/components/MotdOverlay.js'
import { UserMenu } from '~/components/UserMenu.js'

const CodePanel = lazy(() =>
  import('~/components/CodePanel.js').then((m) => ({ default: m.CodePanel })),
)
const MapViewer = lazy(() =>
  import('~/components/MapViewer.js').then((m) => ({ default: m.MapViewer })),
)
import { client, disconnect, isGuest, userInfo, gameTime, isPrivateServer, serverVersion } from '~/stores/clientStore.js'
import { capabilities } from '~/stores/capabilities.js'
import { historyMode, historyTick, enterHistoryMode, exitHistoryMode, seekToTick } from '~/stores/historyStore.js'
import { widescreenMode } from '~/stores/settingsStore.js'
import { toggleShowLog, toggleShowConsole, toggleShowMemory } from '~/stores/consoleStore.js'
import { setRoomViewMode } from '~/stores/roomViewStore.js'
import { route, goToUser, goToGame, goToMarket } from '~/stores/routeStore.js'
import { Overview } from '~/components/Overview.js'
import { Profile } from '~/components/Profile.js'
import { Market } from '~/components/market/Market.js'
import { BadgePickerModal } from '~/components/BadgePickerModal.js'
import type { Badge } from 'screeps-connectivity'

const DEFAULT_BADGE: Badge = { type: 1, color1: '#4a5060', color2: '#7a9ec0', color3: '#c0daf0', param: 0, flip: false }

import { parseRoomName } from '~/utils/roomName.js'
import { basePath } from '~/utils/embedded.js'
import { buildMapUrl, buildRoomUrl } from '~/utils/gameRoutes.js'
import { isTypingTarget } from '~/utils/dom.js'
import { LS, getStr, setStr, removeLocal, getNum, setNum } from '~/utils/storage.js'

// Shard used to live in the ?shard query; it now sits in the path. Still read
// the query as a fallback so old bookmarks keep resolving to the right shard.
function legacyQueryShard(): string | null {
  return new URLSearchParams(window.location.search).get('shard')
}

function parseRoomUrl(): { room: string | null; shard: string | null; tick: number | null } {
  const prefix = `${basePath()}/room/`
  const path = window.location.pathname
  if (!path.startsWith(prefix)) return { room: null, shard: null, tick: null }
  const segments = path.slice(prefix.length).split('/').filter(Boolean)
  // /room/<room> or /room/<shard>/<room>
  const roomSeg = segments.length >= 2 ? segments[1] : segments[0]
  const pathShard = segments.length >= 2 ? decodeURIComponent(segments[0]) : null
  if (!roomSeg) return { room: null, shard: null, tick: null }
  const room = roomSeg.toUpperCase()
  if (!parseRoomName(room)) return { room: null, shard: null, tick: null }
  const shard = pathShard ?? legacyQueryShard()
  const tickMatch = window.location.hash.match(/tick=(\d+)/)
  const tick = tickMatch ? parseInt(tickMatch[1], 10) : null
  return { room, shard, tick }
}

function parseMapUrl(): { shard: string | null } | null {
  const mapPath = `${basePath()}/map`
  const path = window.location.pathname
  if (path !== mapPath && !path.startsWith(`${mapPath}/`)) return null
  const rest = path.slice(mapPath.length).replace(/^\//, '')
  const pathShard = rest ? decodeURIComponent(rest.split('/')[0]) : null
  return { shard: pathShard ?? legacyQueryShard() }
}

function HeaderButton(props: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: JSX.Element
}) {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={() => props.onClick()}
      style={{
        padding: '7px',
        'border-radius': '4px',
        border: `1px solid ${props.active ? '#388bfd' : '#30363d'}`,
        background: props.active ? '#1f3158' : '#21262d',
        color: props.disabled ? '#484f58' : props.active ? '#58a6ff' : '#c9d1d9',
        cursor: props.disabled ? 'default' : 'pointer',
        margin: '0 4px',
        display: 'flex',
        'align-items': 'center',
      }}
    >
      {props.children}
    </button>
  )
}


export function Dashboard() {
  const urlState = parseRoomUrl()
  const [room, setRoom] = createSignal(urlState.room ?? getStr(LS.room) ?? 'W1N1')
  const [shard, setShard] = createSignal<string | null>(urlState.shard ?? getStr(LS.shard))
  const [mapMode, setMapMode] = createSignal(parseMapUrl() !== null || !urlState.room)

  // Server message-of-the-day, shown once over the map for guest sessions after
  // connecting. Dismissed manually or by its own timer; never re-shown afterwards.
  const motdText = () => serverVersion()?.serverData?.welcomeText ?? null
  const [motdDismissed, setMotdDismissed] = createSignal(false)
  const showMotd = () => isGuest() && mapMode() && !motdDismissed() && motdText() !== null

  const [showSettings, setShowSettings] = createSignal(false)
  const [showBadgePicker, setShowBadgePicker] = createSignal(!isGuest() && !userInfo()?.badge)
  const [showCode, setShowCode] = createSignal(false)
  // Suppresses sidebar transition for one render cycle whenever showCode toggles,
  // so both open and close are instant with no CSS animation.
  const [suppressSidebarTransition, setSuppressSidebarTransition] = createSignal(false)
  createEffect(() => {
    showCode() // track
    setSuppressSidebarTransition(true)
    Promise.resolve().then(() => setSuppressSidebarTransition(false))
  })

  // Guest sessions are read-only: force the room view back to 'view' so the
  // (now hidden) flag/build modes can't linger from a previous owned session.
  createEffect(() => {
    if (isGuest()) setRoomViewMode('view')
  })
  // No shard in URL/localStorage but server has shards — fall back to the first reported shard.
  createEffect(() => {
    if (shard() !== null) return
    if (isPrivateServer() !== false) return
    const firstShard = serverVersion()?.serverData?.shards?.[0]
    if (firstShard) setShard(firstShard)
  })

  const [mapOriginRoom, setMapOriginRoom] = createSignal<string | undefined>(undefined)
  const [hoveredRoomInfo, setHoveredRoomInfo] = createSignal<RoomInfo | null>(null)
  const [selectedRoomInfo, setSelectedRoomInfo] = createSignal<RoomInfo | null>(null)
  const savedMapZoom = getStr(LS.mapZoom)
  const [mapZoom, setMapZoom] = createSignal<number | null>(urlState.room && savedMapZoom ? Number(savedMapZoom) : null)
  const [mapSubsActive, setMapSubsActive] = createSignal<boolean | null>(null)
  // Size of a history chunk, mirroring the fallback in RoomViewer (private servers
  // default to 20, the official server to 100).
  const historyChunkSize = () =>
    serverVersion()?.serverData?.historyChunkSize ?? ((isPrivateServer() ?? true) ? 20 : 100)

  // Consumed once when gameTime first becomes available
  let pendingHistoryTick: number | null = urlState.tick
  createEffect(() => {
    const t = gameTime()
    if (t === null || pendingHistoryTick === null) return
    const targetTick = pendingHistoryTick
    pendingHistoryTick = null
    enterHistoryMode(t, serverVersion()?.serverData?.historyKeepTicks, historyChunkSize())
    seekToTick(targetTick)
  })

  // Close code editor and settings panel when any overlay route becomes active (mutual exclusion).
  createEffect(() => {
    if (route() !== 'game') {
      setShowCode(false)
      setShowSettings(false)
    }
  })

  // Sync room URL / history-tick hash while in room view.
  // mapMode is read via untrack so that mode transitions (handled by explicit
  // pushState calls in toggleMap / openMap / the navigation handler) don't
  // trigger a redundant replaceState that races with those pushState calls.
  createEffect(() => {
    if (untrack(mapMode)) return
    const base = buildRoomUrl(room(), shard())
    if (historyMode()) {
      history.replaceState(null, '', `${base}#tick=${historyTick()}`)
    } else {
      history.replaceState(null, '', base)
    }
  })

  const [sidebarWidth, setSidebarWidth] = createSignal(getNum(LS.sidebarWidth, 300))
  const [sidebarPrevWidth, setSidebarPrevWidth] = createSignal(getNum(LS.sidebarWidth, 300))
  const [consoleHeight, setConsoleHeight] = createSignal(getNum(LS.consoleHeight, 220))
  const [consolePrevHeight, setConsolePrevHeight] = createSignal(getNum(LS.consoleHeight, 220))
  const [sidebarDragging, setSidebarDragging] = createSignal(false)
  const [consoleDragging, setConsoleDragging] = createSignal(false)

  const sidebarCollapsed = () => sidebarWidth() <= 32
  const consoleCollapsed = () => consoleHeight() <= 32

  const toggleSidebar = () => {
    if (sidebarWidth() > 32) {
      setSidebarPrevWidth(sidebarWidth())
      setSidebarWidth(32)
    } else {
      setSidebarWidth(sidebarPrevWidth())
    }
  }

  const toggleConsole = () => {
    if (consoleHeight() > 32) {
      setConsolePrevHeight(consoleHeight())
      setConsoleHeight(32)
    } else {
      setConsoleHeight(consolePrevHeight())
    }
  }

  const startSidebarDrag = (e: PointerEvent) => {
    e.preventDefault()
    setSidebarDragging(true)
    const startX = e.clientX
    const startWidth = sidebarWidth()

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      setSidebarWidth(Math.max(32, Math.min(500, startWidth - delta)))
    }

    const onUp = () => {
      setSidebarDragging(false)
      setNum(LS.sidebarWidth, sidebarWidth())
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startConsoleDrag = (e: PointerEvent) => {
    e.preventDefault()
    setConsoleDragging(true)
    const startY = e.clientY
    const startHeight = consoleHeight()

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientY - startY
      setConsoleHeight(Math.max(32, Math.min(500, startHeight - delta)))
    }

    const onUp = () => {
      setConsoleDragging(false)
      setNum(LS.consoleHeight, consoleHeight())
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleNavigate = (r: string, s: string | null) => {
    client()?.stores.navigation.navigateTo(r, s)
  }

  const handleShardChange = (s: string) => {
    setShard(s)
    setStr(LS.shard, s)
    history.pushState(null, '', buildMapUrl(s))
  }

  const openMap = (originRoom: string) => {
    if (untrack(historyMode)) exitHistoryMode()
    setMapOriginRoom(originRoom)
    setMapMode(true)
    history.pushState(null, '', buildMapUrl(shard()))
  }

  onMount(() => {
    // Ensure URL reflects the active view even when loaded without a path
    if (!parseRoomUrl().room && !parseMapUrl()) {
      history.replaceState(null, '', buildMapUrl(shard()))
    }

    const onPopState = () => {
      const mapState = parseMapUrl()
      if (mapState) {
        setMapMode(true)
        if (mapState.shard !== null) setShard(mapState.shard)
        if (untrack(historyMode)) exitHistoryMode()
        return
      }
      const { room: r, shard: s, tick: t } = parseRoomUrl()
      if (r) {
        setRoom(r)
        setShard(s)
        setMapMode(false)
        if (t !== null) {
          pendingHistoryTick = t
        } else if (untrack(historyMode)) {
          exitHistoryMode()
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    onCleanup(() => window.removeEventListener('popstate', onPopState))

    const nav = client()?.stores.navigation
    if (nav) {
      const navSub = nav.on('navigation:change', (state) => {
        if (state.room === null) return
        if (untrack(historyMode)) exitHistoryMode()
        setRoom(state.room)
        setShard(state.shard)
        setMapMode(false)
        setHoveredRoomInfo(null)
        setSelectedRoomInfo(null)
        setStr(LS.room, state.room)
        if (state.shard) setStr(LS.shard, state.shard)
        else removeLocal(LS.shard)
        history.pushState(null, '', buildRoomUrl(state.room, state.shard))
      })
      onCleanup(() => navSub.dispose())
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'o' || e.key === 'O') {
        setShowCode((v) => !v)
        setShowSettings(false)
        return
      }
      if (e.key === 'l' || e.key === 'L') {
        toggleShowLog()
      }
      if (e.key === 'c' || e.key === 'C') {
        toggleShowConsole()
      }
      if (e.key === 'y' || e.key === 'Y') {
        toggleShowMemory()
      }
      if (!mapMode()) {
        if (e.key === '1') setRoomViewMode('view')
        if (!isGuest()) {
          if (e.key === '2') setRoomViewMode('flag')
          if (e.key === '3') setRoomViewMode('build')
        }
        if (e.key === 'm') openMap(room())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  const canvasArea = () => (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <Show when={showCode()}>
        <CodePanel onClose={() => setShowCode(false)} />
      </Show>
      <Show
        when={!mapMode()}
        fallback={
          <MapViewer
            shard={shard()}
            originRoom={mapOriginRoom()}
            initialZoom={mapZoom() ?? undefined}
            onNavigateToRoom={(r) => handleNavigate(r, shard())}
            onHoveredRoomChanged={setHoveredRoomInfo}
            onSelectedRoomChanged={setSelectedRoomInfo}
            onZoomChanged={(z) => {
              setMapZoom(z)
              setNum(LS.mapZoom, z)
            }}
            onSubscriptionStateChanged={setMapSubsActive}
          />
        }
      >
        <RoomViewer room={room()} shard={shard()} onNavigate={handleNavigate} />
        <button
          onClick={() => openMap(room())}
          title="World Map"
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            'z-index': 5,
            padding: '12px',
            'border-radius': '6px',
            border: '1px solid #30363d',
            background: 'rgba(33,38,45,0.85)',
            color: '#c9d1d9',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
          }}
        >
          <Map size={24} />
        </button>
        <Show when={capabilities().hasHistory}>
          <button
            onClick={() => (historyMode() ? exitHistoryMode() : gameTime() !== null && enterHistoryMode(gameTime()!, serverVersion()?.serverData?.historyKeepTicks, historyChunkSize()))}
            disabled={!historyMode() && gameTime() === null}
            title="History"
            style={{
              position: 'absolute',
              top: '66px',
              left: '8px',
              'z-index': 5,
              padding: '12px',
              'border-radius': '6px',
              border: `1px solid ${historyMode() ? '#58a6ff' : '#30363d'}`,
              background: historyMode() ? 'rgba(31,111,235,0.85)' : 'rgba(33,38,45,0.85)',
              color: '#c9d1d9',
              cursor: !historyMode() && gameTime() === null ? 'not-allowed' : 'pointer',
              display: 'flex',
              'align-items': 'center',
              opacity: !historyMode() && gameTime() === null ? 0.4 : 1,
            }}
          >
            <Clock size={24} />
          </button>
        </Show>
      </Show>
      <Show when={showMotd()}>
        <MotdOverlay text={motdText()!} onClose={() => setMotdDismissed(true)} />
      </Show>
    </div>
  )

  const consoleArea = () => (
    <Show when={!isGuest()}>
      <div
        style={{
          height: `${consoleHeight()}px`,
          'border-top': '1px solid #30363d',
          transition: consoleDragging() ? 'none' : 'height 0.15s ease',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          onPointerDown={startConsoleDrag}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', cursor: 'row-resize', 'z-index': 10, background: '#21262d' }}
        />
        <ConsolePanel shard={shard()} isCollapsed={consoleCollapsed()} onToggle={toggleConsole} />
      </div>
    </Show>
  )

  // `animate` is false in widescreen mode — the full-height sidebar should snap
  // rather than animate width changes alongside other layout shifts.
  const sidebarArea = (animate: boolean) => (
    <div
      style={{
        width: showCode() ? '0' : `${sidebarWidth()}px`,
        'border-left': '1px solid #30363d',
        transition: animate && !(suppressSidebarTransition() || sidebarDragging()) ? 'width 0.15s ease' : 'none',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        onPointerDown={startSidebarDrag}
        style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', cursor: 'col-resize', 'z-index': 10, background: '#21262d' }}
      />
      <Sidebar
        isCollapsed={sidebarCollapsed()}
        onToggle={toggleSidebar}
        mapMode={mapMode()}
        hoveredRoomInfo={hoveredRoomInfo()}
        selectedRoomInfo={selectedRoomInfo()}
        room={room()}
        shard={shard()}
        mapZoom={mapZoom()}
        mapSubsActive={mapSubsActive()}
        onShardChange={handleShardChange}
      />
    </div>
  )

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        'flex-direction': 'column',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', 'border-bottom': '1px solid #30363d', 'align-items': 'center' }}>
        <ConnectionStatus />
        <Show when={!isGuest() || mapMode()}>
          <StatsBar
            mapZoom={mapMode() ? mapZoom() : null}
            mapSubsActive={mapMode() ? mapSubsActive() : null}
          />
        </Show>
        <div style={{ flex: 1 }} />
        <HeaderButton
          title={route() === 'user' || route() === 'profile' ? 'Close overview' : 'Overview'}
          active={route() === 'user' || route() === 'profile'}
          disabled={isGuest() && route() !== 'user' && route() !== 'profile'}
          onClick={() => (route() === 'user' || route() === 'profile') ? goToGame() : goToUser()}
        >
          <LayoutDashboard size={16} />
        </HeaderButton>
        <Show when={!isGuest() && capabilities().hasMarket}>
          <HeaderButton
            title={route() === 'market' ? 'Close Market' : 'Market'}
            active={route() === 'market'}
            onClick={() => route() === 'market' ? goToGame() : goToMarket(shard())}
          >
            <Store size={16} />
          </HeaderButton>
        </Show>
        <Show when={!isGuest()}>
          <HeaderButton title="Code Editor" active={showCode()} onClick={() => { if (route() !== 'game') goToGame(); setShowCode((v) => !v); setShowSettings(false) }}>
            <Code2 size={16} />
          </HeaderButton>
        </Show>
        <Show
          when={!isGuest()}
          fallback={
            <>
              <HeaderButton title="Settings" active={showSettings()} onClick={() => { if (route() !== 'game') goToGame(); setShowSettings((v) => !v); setShowCode(false) }}>
                <Settings size={16} />
              </HeaderButton>
              <button
                title="Login"
                onClick={disconnect}
                style={{
                  padding: '7px',
                  'border-radius': '4px',
                  border: 'none',
                  background: '#238636',
                  color: '#fff',
                  cursor: 'pointer',
                  margin: '0 16px 0 8px',
                  display: 'flex',
                  'align-items': 'center',
                }}
              >
                <LogIn size={16} />
              </button>
            </>
          }
        >
          <UserMenu
            onOpenSettings={() => { if (route() !== 'game') goToGame(); setShowSettings(true); setShowCode(false) }}
            onOpenBadgePicker={() => setShowBadgePicker(true)}
          />
        </Show>
      </div>

      {/* Main body — game canvas stays mounted; overview/profile appear as an absolute overlay */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}>
        <Show
          when={widescreenMode()}
          fallback={
            /* Normal mode: console spans full width below canvas+sidebar */
            <div style={{ display: 'flex', 'flex-direction': 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {canvasArea()}
                {sidebarArea(true)}
              </div>
              {consoleArea()}
            </div>
          }
        >
          {/* Widescreen mode: sidebar spans full height, console below canvas only */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', 'flex-direction': 'column', flex: 1, overflow: 'hidden' }}>
              {canvasArea()}
              {consoleArea()}
            </div>
            {sidebarArea(false)}
          </div>
        </Show>
        <Show when={route() === 'user' || route() === 'profile' || route() === 'market' || showSettings()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 'z-index': 10, overflow: 'hidden' }}>
            <Show when={route() === 'user'}><Overview /></Show>
            <Show when={route() === 'profile'}><Profile /></Show>
            <Show when={route() === 'market'}><Market /></Show>
            <Show when={showSettings()}><SettingsPanel onClose={() => setShowSettings(false)} /></Show>
          </div>
        </Show>
      </div>
      <ToastContainer />
      <Show when={showBadgePicker()}>
        <BadgePickerModal
          badge={userInfo()?.badge ?? DEFAULT_BADGE}
          onClose={() => setShowBadgePicker(false)}
        />
      </Show>
    </div>
  )
}
