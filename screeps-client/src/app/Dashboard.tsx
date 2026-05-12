import { createSignal } from 'solid-js'
import { ConnectionStatus } from '~/components/ConnectionStatus.js'
import { RoomNavigator } from '~/components/RoomNavigator.js'
import { RoomViewer } from '~/components/RoomViewer.js'
import { ConsolePanel } from '~/components/ConsolePanel.js'
import { StatsBar } from '~/components/StatsBar.js'

export function Dashboard() {
  const [room, setRoom] = createSignal('W1N1')
  const [shard, setShard] = createSignal('shard0')

  const handleNavigate = (r: string, s: string) => {
    setRoom(r)
    setShard(s)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        'grid-template-rows': 'auto auto 1fr',
        'grid-template-columns': '1fr 320px',
        'grid-template-areas': `"header header" "nav nav" "canvas console"`,
        overflow: 'hidden',
      }}
    >
      <div style={{ 'grid-area': 'header', display: 'flex', 'border-bottom': '1px solid #30363d' }}>
        <ConnectionStatus />
        <StatsBar />
      </div>

      <div style={{ 'grid-area': 'nav' }}>
        <RoomNavigator
          onNavigate={handleNavigate}
          currentRoom={room()}
          currentShard={shard()}
        />
      </div>

      <div style={{ 'grid-area': 'canvas', position: 'relative', overflow: 'hidden' }}>
        <RoomViewer room={room()} shard={shard()} />
      </div>

      <div style={{ 'grid-area': 'console', padding: '8px', overflow: 'hidden' }}>
        <ConsolePanel shard={shard()} />
      </div>
    </div>
  )
}
