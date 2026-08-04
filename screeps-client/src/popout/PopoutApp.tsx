import { Show, lazy } from 'solid-js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { ToastContainer } from '~/components/ToastContainer.js'
import { installPopoutClient } from '~/stores/clientStore.js'
import { setShowConsole, setShowLog, setShowMemory } from '~/stores/consoleStore.js'
import { createRemoteClient } from './remoteClient.js'
import { createPopoutRpc } from './rpc.js'
import { PopoutOverlay } from './PopoutOverlay.js'

// Lazy like the Dashboard's MapViewer: console popouts must not pay for PixiJS.
const MapPopout = lazy(() =>
  import('./MapPopout.js').then((m) => ({ default: m.MapPopout })),
)

/**
 * Root component for popout windows (?popout in the URL). Renders the console
 * panel — or the world map — full-window, backed by an RPC client shim instead
 * of a connection of its own: the main window answers over the session's
 * BroadcastChannel.
 */
export function PopoutApp() {
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid') ?? ''
  const shard = params.get('shard')
  const panes = (params.get('panes') ?? 'log,console').split(',')
  const isMap = panes.includes('map')
  if (!isMap) {
    setShowLog(panes.includes('log'))
    setShowConsole(panes.includes('console'))
    setShowMemory(panes.includes('memory'))
  }
  document.title = `Screeps — ${isMap ? 'Map' : panes.join(' · ')}`

  // Installed before the panes mount, so their onMount sees a client
  const rpc = createPopoutRpc(sid)
  installPopoutClient(createRemoteClient(rpc))

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <Show when={isMap} fallback={<ConsolePanel shard={shard} />}>
        <MapPopout rpc={rpc} initialShard={shard} initialRoom={params.get('room')} />
      </Show>
      <Show when={!rpc.hostAlive()}>
        <PopoutOverlay
          title="Main window not reachable"
          message="This popout reconnects automatically as soon as the main window is back."
        />
      </Show>
      {/* Custom UI answers land as toasts — they must be visible in the window
          that sent the command, not only in the main one. */}
      <ToastContainer />
    </div>
  )
}
