// Boot splash shown while the client auto-connects (guest in xxscreeps mode, or
// a returning user's stored token) so the LoginForm never flashes before the
// connection settles.
export function ConnectingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        gap: '16px',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid #30363d',
          'border-top-color': '#58a6ff',
          'border-radius': '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div style={{ color: '#8b949e', 'font-size': '13px' }}>Connecting…</div>
    </div>
  )
}
