import { createSignal } from 'solid-js'
import { connect, status, error } from '~/stores/clientStore.js'

export function LoginForm() {
  const [authType, setAuthType] = createSignal<'password' | 'token'>('password')
  const [url, setUrl] = createSignal('https://screeps.com')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [token, setToken] = createSignal('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    await connect({
      url: url(),
      auth: authType(),
      email: email() || undefined,
      password: password() || undefined,
      token: token() || undefined,
      storage: null,
    })
  }

  const isConnecting = () => status() === 'connecting'

  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          'flex-direction': 'column',
          gap: '16px',
          width: '360px',
          padding: '32px',
          'border-radius': '8px',
          background: '#161b22',
          border: '1px solid #30363d',
        }}
      >
        <h2 style={{ margin: 0, 'font-size': '20px' }}>Connect to Screeps</h2>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setAuthType('password')}
            style={{
              flex: 1,
              padding: '8px',
              'border-radius': '6px',
              border: '1px solid #30363d',
              background: authType() === 'password' ? '#238636' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthType('token')}
            style={{
              flex: 1,
              padding: '8px',
              'border-radius': '6px',
              border: '1px solid #30363d',
              background: authType() === 'token' ? '#238636' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Token
          </button>
        </div>

        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <span style={{ 'font-size': '12px', color: '#8b949e' }}>Server URL</span>
          <input
            type="text"
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            style={{
              padding: '8px 12px',
              'border-radius': '6px',
              border: '1px solid #30363d',
              background: '#0d1117',
              color: '#c9d1d9',
            }}
          />
        </label>

        {authType() === 'password' ? (
          <>
            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Email</span>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                style={{
                  padding: '8px 12px',
                  'border-radius': '6px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                }}
              />
            </label>
            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Password</span>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                style={{
                  padding: '8px 12px',
                  'border-radius': '6px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                }}
              />
            </label>
          </>
        ) : (
          <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
            <span style={{ 'font-size': '12px', color: '#8b949e' }}>Auth Token</span>
            <input
              type="password"
              value={token()}
              onInput={(e) => setToken(e.currentTarget.value)}
              style={{
                padding: '8px 12px',
                'border-radius': '6px',
                border: '1px solid #30363d',
                background: '#0d1117',
                color: '#c9d1d9',
              }}
            />
          </label>
        )}

        {error() && (
          <div style={{ color: '#f85149', 'font-size': '13px' }}>{error()}</div>
        )}

        <button
          type="submit"
          disabled={isConnecting()}
          style={{
            padding: '10px',
            'border-radius': '6px',
            border: 'none',
            background: '#238636',
            color: '#fff',
            'font-weight': 600,
            cursor: isConnecting() ? 'not-allowed' : 'pointer',
            opacity: isConnecting() ? 0.6 : 1,
          }}
        >
          {isConnecting() ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  )
}
