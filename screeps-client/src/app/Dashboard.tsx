import { createEffect, createSignal, lazy, onCleanup, onMount, Show, type JSX } from 'solid-js'
import { Map, LayoutGrid, Code2, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-solid'
import { ConnectionStatus } from '~/components/ConnectionStatus.js'
import { RoomViewer } from '~/components/RoomViewer.js'
import { ToastContainer } from '~/components/ToastContainer.js'
import type { RoomInfo } from '~/components/MapViewer.js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { Sidebar } from '~/components/Sidebar/index.js'
import { StatsBar } from '~/components/StatsBar.js'
import { SettingsPanel } from '~/components/SettingsPanel.js'

const CodePanel = lazy(() =>
  import('~/components/CodePanel.js').then((m) => ({ default: m.CodePanel })),
)
const MapViewer = lazy(() =>
  import('~/components/MapViewer.js').then((m) => ({ default: m.MapViewer })),
)
import { client, disconnect, isGuest, userInfo } from '~/stores/clientStore.js'
import { widescreenMode } from '~/stores/settingsStore.js'
import { toggleShowLog, toggleShowConsole } from '~/stores/consoleStore.js'
import { setRoomViewMode } from '~/stores/roomViewStore.js'

import { parseRoomName } from '~/utils/roomName.js'
import { basePath } from '~/utils/embedded.js'
import { isTypingTarget } from '~/utils/dom.js'
import { LS, getStr, setStr, removeLocal, getNum, setNum } from '~/utils/storage.js'

function parseRoomUrl(): { room: string | null; shard: string | null } {
  const base = basePath()
  const match = window.location.pathname.match(new RegExp(`^${base}/room/([A-Za-z0-9]+)`))
  if (!match) return { room: null, shard: null }
  const room = match[1].toUpperCase()
  if (!parseRoomName(room)) return { room: null, shard: null }
  const shard = new URLSearchParams(window.location.search).get('shard')
  return { room, shard }
}

function buildRoomUrl(room: string, shard: string | null): string {
  return `${basePath()}/room/${room}${shard ? `?shard=${encodeURIComponent(shard)}` : ''}`
}

function buildMapUrl(shard: string | null): string {
  return `${basePath()}/map${shard ? `?shard=${encodeURIComponent(shard)}` : ''}`
}

function parseMapUrl(): { shard: string | null } | null {
  if (!window.location.pathname.startsWith(`${basePath()}/map`)) return null
  const shard = new URLSearchParams(window.location.search).get('shard')
  return { shard }
}

function HeaderButton(props: {
  active?: boolean
  onClick: () => void
  title: string
  children: JSX.Element
}) {
  return (
    <button
      title={props.title}
      onClick={() => props.onClick()}
      style={{
        padding: '7px',
        'border-radius': '4px',
        border: `1px solid ${props.active ? '#388bfd' : '#30363d'}`,
        background: props.active ? '#1f3158' : '#21262d',
        color: props.active ? '#58a6ff' : '#c9d1d9',
        cursor: 'pointer',
        margin: '0 4px',
        display: 'flex',
        'align-items': 'center',
      }}
    >
      {props.children}
    </button>
  )
}

function NavArrowButton(props: { disabled: boolean; onClick: () => void; title: string; children: JSX.Element }) {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={() => props.onClick()}
      style={{
        padding: '7px',
        'border-radius': '4px',
        border: '1px solid #30363d',
        background: '#21262d',
        color: props.disabled ? '#484f58' : '#c9d1d9',
        cursor: props.disabled ? 'default' : 'pointer',
        margin: '0 2px',
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

  const [showSettings, setShowSettings] = createSignal(!isGuest() && !userInfo()?.badge)
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
  const [mapOriginRoom, setMapOriginRoom] = createSignal<string | undefined>(undefined)
  const [hoveredRoomInfo, setHoveredRoomInfo] = createSignal<RoomInfo | null>(null)
  const [selectedRoomInfo, setSelectedRoomInfo] = createSignal<RoomInfo | null>(null)
  const savedMapZoom = getStr(LS.mapZoom)
  const [mapZoom, setMapZoom] = createSignal<number | null>(urlState.room && savedMapZoom ? Number(savedMapZoom) : null)
  const [mapSubsActive, setMapSubsActive] = createSignal<boolean | null>(null)
  const [canBack, setCanBack] = createSignal(false)
  const [canForward, setCanForward] = createSignal(false)

  const [sidebarWidth, setSidebarWidth] = createSignal(getNum(LS.sidebarWidth, 260))
  const [sidebarPrevWidth, setSidebarPrevWidth] = createSignal(getNum(LS.sidebarWidth, 260))
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

  const openMap = (originRoom: string) => {
    setMapOriginRoom(originRoom)
    setMapMode(true)
    history.pushState(null, '', buildMapUrl(shard()))
  }

  const toggleMap = () => {
    if (mapMode()) {
      setMapMode(false)
      setHoveredRoomInfo(null)
      setSelectedRoomInfo(null)
      history.pushState(null, '', buildRoomUrl(room(), shard()))
    } else {
      openMap(room())
    }
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
        return
      }
      const { room: r, shard: s } = parseRoomUrl()
      if (r) {
        setRoom(r)
        setShard(s)
        setMapMode(false)
      }
    }
    window.addEventListener('popstate', onPopState)
    onCleanup(() => window.removeEventListener('popstate', onPopState))

    const nav = client()?.stores.navigation
    if (nav) {
      const navSub = nav.on('navigation:change', (state) => {
        if (state.room === null) return
        setRoom(state.room)
        setShard(state.shard)
        setMapMode(false)
        setHoveredRoomInfo(null)
        setSelectedRoomInfo(null)
        setCanBack(nav.canBack())
        setCanForward(nav.canForward())
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
      <Show when={showSettings()}>
        <SettingsPanel onClose={() => setShowSettings(false)} />
      </Show>
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
        <NavArrowButton title="Back" disabled={!canBack()} onClick={() => client()?.stores.navigation.back()}><ChevronLeft size={16} /></NavArrowButton>
        <NavArrowButton title="Forward" disabled={!canForward()} onClick={() => client()?.stores.navigation.forward()}><ChevronRight size={16} /></NavArrowButton>
        <HeaderButton title={mapMode() ? 'Room View' : 'Map'} active={mapMode()} onClick={toggleMap}>
          {mapMode() ? <LayoutGrid size={16} /> : <Map size={16} />}
        </HeaderButton>
        <HeaderButton title="Code Editor" active={showCode()} onClick={() => { setShowCode((v) => !v); setShowSettings(false) }}>
          <Code2 size={16} />
        </HeaderButton>
        <HeaderButton title="Settings" active={showSettings()} onClick={() => { setShowSettings((v) => !v); setShowCode(false) }}>
          <Settings size={16} />
        </HeaderButton>
        <button
          title="Logout"
          onClick={disconnect}
          style={{
            padding: '7px',
            'border-radius': '4px',
            border: 'none',
            background: '#da3633',
            color: '#fff',
            cursor: 'pointer',
            margin: '0 16px 0 8px',
            display: 'flex',
            'align-items': 'center',
          }}
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Main body — layout depends on widescreenMode setting */}
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
      <ToastContainer />
    </div>
  )
}
