import { client, status, disconnect } from '~/stores/clientStore.js'

export function ConnectionStatus() {
  const statusColor = () => {
    switch (status()) {
      case 'connected': return '#238636'
      case 'connecting': return '#d29922'
      case 'error': return '#f85149'
      default: return '#8b949e'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        gap: '12px',
        padding: '8px 16px',
        'border-bottom': '1px solid #30363d',
        'font-size': '13px',
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            'border-radius': '50%',
            'background-color': statusColor(),
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#8b949e' }}>
          {status() === 'connected' ? 'Online' : status()}
        </span>
      </div>
      {client() && (
        <button
          onClick={disconnect}
          style={{
            'margin-left': 'auto',
            padding: '4px 10px',
            'border-radius': '4px',
            border: '1px solid #30363d',
            background: 'transparent',
            color: '#c9d1d9',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      )}
    </div>
  )
}
