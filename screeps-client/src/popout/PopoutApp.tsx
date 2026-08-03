import { Show } from 'solid-js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { installPopoutClient } from '~/stores/clientStore.js'
import { setShowConsole, setShowLog, setShowMemory } from '~/stores/consoleStore.js'
import { createRemoteClient } from './remoteClient.js'
import { createPopoutRpc } from './rpc.js'

/**
 * Root component for popout windows (?popout in the URL). Renders the console
 * panel full-window, backed by an RPC client shim instead of a connection of
 * its own — the main window answers over the session's BroadcastChannel.
 */
export function PopoutApp() {
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid') ?? ''
  const shard = params.get('shard')
  const panes = (params.get('panes') ?? 'log,console').split(',')
  setShowLog(panes.includes('log'))
  setShowConsole(panes.includes('console'))
  setShowMemory(panes.includes('memory'))
  document.title = `Screeps — ${panes.join(' · ')}`

  // Installed before ConsolePanel mounts, so its onMount sees a client
  const rpc = createPopoutRpc(sid)
  installPopoutClient(createRemoteClient(rpc))

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <ConsolePanel shard={shard} />
      <Show when={!rpc.hostAlive()}>
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background: 'rgba(13, 17, 23, 0.88)',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'z-index': 100,
          }}
        >
          <div
            style={{
              color: '#c9d1d9',
              background: '#161b22',
              border: '1px solid #30363d',
              'border-radius': '6px',
              padding: '16px 24px',
              'font-size': '13px',
              'max-width': '360px',
              'text-align': 'center',
              'line-height': '1.6',
            }}
          >
            <div style={{ 'font-weight': 600, 'margin-bottom': '4px' }}>Main window not reachable</div>
            <div style={{ color: '#8b949e' }}>
              This popout reconnects automatically as soon as the main window is back.
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
