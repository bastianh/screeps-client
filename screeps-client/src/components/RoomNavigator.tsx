import { createSignal } from 'solid-js'

interface RoomNavigatorProps {
  onNavigate: (room: string, shard: string) => void
  currentRoom?: string
  currentShard?: string
}

export function RoomNavigator(props: RoomNavigatorProps) {
  const [room, setRoom] = createSignal(props.currentRoom ?? 'W1N1')
  const [shard, setShard] = createSignal(props.currentShard ?? 'shard0')

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    props.onNavigate(room(), shard())
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 16px',
        'align-items': 'center',
      }}
    >
      <span style={{ 'font-size': '12px', color: '#8b949e' }}>Room</span>
      <input
        type="text"
        value={room()}
        onInput={(e) => setRoom(e.currentTarget.value.toUpperCase())}
        style={{
          width: '80px',
          padding: '6px 8px',
          'border-radius': '4px',
          border: '1px solid #30363d',
          background: '#0d1117',
          color: '#c9d1d9',
          'font-size': '13px',
        }}
      />
      <span style={{ 'font-size': '12px', color: '#8b949e' }}>Shard</span>
      <input
        type="text"
        value={shard()}
        onInput={(e) => setShard(e.currentTarget.value)}
        style={{
          width: '80px',
          padding: '6px 8px',
          'border-radius': '4px',
          border: '1px solid #30363d',
          background: '#0d1117',
          color: '#c9d1d9',
          'font-size': '13px',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '6px 14px',
          'border-radius': '4px',
          border: 'none',
          background: '#238636',
          color: '#fff',
          'font-size': '13px',
          cursor: 'pointer',
        }}
      >
        Load
      </button>
    </form>
  )
}
