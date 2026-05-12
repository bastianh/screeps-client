import { createSignal } from 'solid-js'
import { ConnectionStatus } from '~/components/ConnectionStatus.js'
import { RoomNavigator } from '~/components/RoomNavigator.js'
import { RoomViewer } from '~/components/RoomViewer.js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { Sidebar } from '~/components/Sidebar.js'
import { StatsBar } from '~/components/StatsBar.js'

export function Dashboard() {
  const [room, setRoom] = createSignal('W1N1')
  const [shard, setShard] = createSignal('shard0')
  const [sidebarOpen, setSidebarOpen] = createSignal(true)
  const [consoleOpen, setConsoleOpen] = createSignal(true)

  const handleNavigate = (r: string, s: string) => {
    setRoom(r)
    setShard(s)
  }

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
      <div style={{ display: 'flex', 'border-bottom': '1px solid #30363d' }}>
        <ConnectionStatus />
        <StatsBar />
      </div>

      {/* Nav */}
      <div style={{ 'border-bottom': '1px solid #30363d' }}>
        <RoomNavigator
          onNavigate={handleNavigate}
          currentRoom={room()}
          currentShard={shard()}
        />
      </div>

      {/* Main body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Center: canvas + bottom console */}
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <RoomViewer room={room()} shard={shard()} />
          </div>

          {/* Bottom Console */}
          <div
            style={{
              height: consoleOpen() ? '220px' : '32px',
              'border-top': '1px solid #30363d',
              transition: 'height 0.2s ease',
              overflow: 'hidden',
            }}
          >
            <ConsolePanel
              shard={shard()}
              onToggle={() => setConsoleOpen((v) => !v)}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          style={{
            width: sidebarOpen() ? '260px' : '32px',
            'border-left': '1px solid #30363d',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}
        >
          <Sidebar onToggle={() => setSidebarOpen((v) => !v)} />
        </div>
      </div>
    </div>
  )
}
