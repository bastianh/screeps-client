import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import type { NavigationState } from 'screeps-connectivity'
import { MapViewer } from '~/components/MapViewer.js'
import type { RoomInfo } from '~/components/MapViewer.js'
import { MapInfoPanel } from '~/components/MapInfoPanel.js'
import { RoomInfoBox } from '~/components/Sidebar/RoomInfoBox.js'
import { CustomUiPanel } from '~/components/Sidebar/CustomUiPanel.js'
import { applyPopoutSessionState } from '~/stores/clientStore.js'
import { initCustomUi, disposeCustomUi } from '~/stores/customUiStore.js'
import { parseMapView, mapViewQuery } from '~/utils/gameRoutes.js'
import { createLogger } from '~/utils/log.js'
import { NAVIGATION_TOPIC } from './protocol.js'
import type { PopoutSessionState } from './protocol.js'
import type { PopoutRpc } from './rpc.js'
import { PopoutOverlay } from './PopoutOverlay.js'

const { log } = createLogger('popout-map')

/**
 * The world map rendered in a popout window, against the RPC client shim. The
 * main window's room view stays authoritative: its navigation events drive the
 * highlighted room (and shard) here, and navigating from this map — second
 * click on the selected room, or the `m` key — is proxied back to the host.
 *
 * Only one map exists at a time: this window announces itself with a
 * `mapclose` broadcast on startup and yields (closes, or shows an overlay when
 * the browser refuses to close a hand-opened tab) when another window does.
 */
export function MapPopout(props: { rpc: PopoutRpc; initialShard: string | null; initialRoom: string | null }) {
  // Stable for the window's lifetime — the rpc endpoint never changes.
  // eslint-disable-next-line solid/reactivity
  const rpc = props.rpc
  const initialView = parseMapView(window.location.search)

  const [shard, setShard] = createSignal(props.initialShard)
  // `equals: false` so a repeated navigation to the same room still re-asserts
  // the selection after the user moved this map's own selection elsewhere.
  const [selectedRoom, setSelectedRoom] = createSignal(props.initialRoom, { equals: false })
  const [hoveredInfo, setHoveredInfo] = createSignal<RoomInfo | null>(null)
  const [selectedInfo, setSelectedInfo] = createSignal<RoomInfo | null>(null)
  const [zoom, setZoom] = createSignal<number | null>(initialView.zoom)
  const [subsActive, setSubsActive] = createSignal(false)
  const [closedByTakeover, setClosedByTakeover] = createSignal(false)
  const [sidebarHidden, setSidebarHidden] = createSignal(
    new URLSearchParams(window.location.search).get('sidebar') === '0',
  )

  // Kept in the popout URL like the camera, so a tab reload restores it.
  const toggleSidebar = () => {
    const hidden = !sidebarHidden()
    setSidebarHidden(hidden)
    const params = new URLSearchParams(window.location.search)
    if (hidden) params.set('sidebar', '0')
    else params.delete('sidebar')
    history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }

  // Take the map over from whoever currently shows one — the main window's
  // inline map, or an older map popout on this session.
  rpc.postMapClose()

  // Started after the first session sync, which is what puts the host's server
  // URL in place — the custom UI segment setting is keyed by it. The console
  // subscription behind it is re-issued by rpc.ts on a rebind, so once is enough.
  let customUiStarted = false

  // Re-sync the session on every host (re)bind: seeds userInfo/serverVersion for
  // the map and adopts the main window's current room, healing after a
  // main-window reload the same way the topic re-subscription in rpc.ts does.
  createEffect(() => {
    if (!rpc.hostAlive()) return
    void (async () => {
      try {
        const state = await rpc.call('session.state', []) as PopoutSessionState
        applyPopoutSessionState(state)
        if (state.shard !== null) setShard(state.shard)
        if (state.room !== null) setSelectedRoom(state.room)
        if (!customUiStarted) {
          customUiStarted = true
          initCustomUi()
        }
      } catch (err) {
        log('session sync failed:', err)
      }
    })()
  })
  onCleanup(disposeCustomUi)

  // Follow the main window's room view.
  const navGate = rpc.subscribe(NAVIGATION_TOPIC)
  const navSub = rpc.on('navigation:change', (data) => {
    const state = data as NavigationState
    if (state.room === null) return
    setShard(state.shard)
    setSelectedRoom(state.room)
  })
  const closeSub = rpc.on('mapclose', () => {
    // Flip the overlay first: when the browser refuses to close a hand-opened
    // tab, the map underneath is already covered.
    setClosedByTakeover(true)
    window.close()
  })
  onCleanup(() => {
    navGate.dispose()
    navSub.dispose()
    closeSub.dispose()
  })

  // Mirror the camera into this window's own URL so a tab reload (or a
  // bookmarked popout) restores the view. Camera params are rewritten in place;
  // the popout/sid/panes/shard/room params stay untouched.
  const writeCamera = (pos: { x: number; y: number }) => {
    const params = new URLSearchParams(window.location.search)
    params.delete('zoom')
    params.delete('pos')
    const parts = [params.toString(), ...mapViewQuery({ pos, zoom: zoom() })].filter(Boolean)
    history.replaceState(null, '', `${window.location.pathname}?${parts.join('&')}`)
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapViewer
          shard={shard()}
          originRoom={props.initialRoom ?? undefined}
          selectedRoom={selectedRoom()}
          initialZoom={initialView.zoom ?? undefined}
          centerPos={initialView.pos ?? undefined}
          onNavigateToRoom={(room) => void rpc.call('navigation.navigateTo', [room, shard()])}
          onHoveredRoomChanged={setHoveredInfo}
          onSelectedRoomChanged={setSelectedInfo}
          onZoomChanged={setZoom}
          onCenterChanged={writeCamera}
          onSubscriptionStateChanged={setSubsActive}
        />
      </div>
      <div
        style={{
          width: sidebarHidden() ? '32px' : '260px',
          'flex-shrink': 0,
          'border-left': '1px solid #30363d',
          display: 'flex',
          'flex-direction': 'row',
          overflow: 'hidden',
        }}
      >
        {/* Collapsed strip — always visible, clickable background (same pattern
            as the main window's Sidebar). */}
        <div
          onClick={toggleSidebar}
          style={{
            width: '32px',
            height: '100%',
            'flex-shrink': 0,
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'border-right': sidebarHidden() ? 'none' : '1px solid #30363d',
            padding: '8px 0',
            cursor: 'pointer',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleSidebar()
            }}
            title={sidebarHidden() ? 'Show sidebar' : 'Hide sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              'font-size': '14px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            {sidebarHidden() ? '◀' : '▶'}
          </button>
        </div>
        <Show when={!sidebarHidden()}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              'flex-direction': 'column',
              overflow: 'hidden',
            }}
          >
            <MapInfoPanel zoom={zoom()} subsActive={subsActive()} shard={shard()} onShardChange={setShard} />
            {/* Same split as the main window's map sidebar: the info boxes take
                the free space and scroll, the custom UI stays pinned below. */}
            <div style={{ flex: 1, overflow: 'auto', 'min-height': 0, 'padding-bottom': '8px' }}>
              <RoomInfoBox label="Selected" info={selectedInfo()} />
              <RoomInfoBox label="Cursor" info={hoveredInfo()} dim />
            </div>
            <CustomUiPanel mode="map" shard={shard()} selectedRoomInfo={selectedInfo()} />
          </div>
        </Show>
      </div>
      <Show when={closedByTakeover()}>
        <PopoutOverlay
          title="Map moved to the main window"
          message="This popout gave up the map. You can close this window."
        >
          <button
            onClick={() => {
              rpc.postMapClose()
              setClosedByTakeover(false)
            }}
            style={{
              'margin-top': '12px',
              padding: '6px 14px',
              'border-radius': '6px',
              border: '1px solid #30363d',
              background: '#21262d',
              color: '#c9d1d9',
              cursor: 'pointer',
              'font-size': '12px',
            }}
          >
            Show the map here again
          </button>
        </PopoutOverlay>
      </Show>
    </div>
  )
}
