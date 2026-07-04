import { Show } from 'solid-js'
import { sessionError, disconnect } from '~/stores/clientStore.js'

// Shown over the Dashboard when the active session hits a fatal error (socket
// gave up reconnecting, or the server closed the connection for good). Rather
// than silently bouncing back to the login screen, this surfaces the error and
// lets the user choose to reload (retry from scratch) or log out explicitly.
export function SessionErrorModal() {
  return (
    <Show when={sessionError()}>
      <div
        style={{
          position: 'fixed',
          inset: '0',
          background: 'rgba(0,0,0,0.65)',
          'z-index': 500,
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        }}
      >
        <div
          style={{
            width: 'min(440px, calc(100% - 48px))',
            background: '#161b22',
            border: '1px solid #30363d',
            'border-radius': '8px',
            'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
            padding: '20px',
          }}
        >
          <div style={{ 'font-size': '16px', 'font-weight': 600, color: '#f85149', 'margin-bottom': '12px' }}>
            Connection lost
          </div>
          <p style={{ 'font-size': '13px', color: '#c9d1d9', 'line-height': '1.5', margin: '0 0 18px' }}>
            {sessionError()}
          </p>
          <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px' }}>
            <button
              onClick={() => disconnect()}
              style={{
                padding: '7px 14px',
                'border-radius': '4px',
                border: '1px solid #30363d',
                background: '#21262d',
                color: '#c9d1d9',
                cursor: 'pointer',
                'font-size': '13px',
              }}
            >
              Logout
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '7px 14px',
                'border-radius': '4px',
                border: 'none',
                background: '#58a6ff',
                color: '#0d1117',
                cursor: 'pointer',
                'font-size': '13px',
                'font-weight': 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
