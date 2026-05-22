import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js'
import { connect, status, error } from '~/stores/clientStore.js'
import { isEmbedded, isXxscreepsMode, embeddedServerUrl } from '~/utils/embedded.js'
import {
  fetchServerVersion,
  fetchAuthModInfo,
  checkUsername,
  checkEmail,
  registerUser,
  getScreepsmodAuth,
} from 'screeps-connectivity'
import type { ServerVersion, ApiAuthModInfoResponse } from 'screeps-connectivity'

// ── shared styles ─────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '8px 12px',
  'border-radius': '6px',
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#c9d1d9',
}

// ── pre-login server info hook ─────────────────────────────────────────────────

function useServerInfo(url: () => string) {
  const [serverVersion, setServerVersion] = createSignal<ServerVersion | null>(null)
  const [authModInfo, setAuthModInfo] = createSignal<ApiAuthModInfoResponse | null>(null)
  const [serverError, setServerError] = createSignal<string | null>(null)

  createEffect(() => {
    const rawUrl = url()
    setServerVersion(null)
    setAuthModInfo(null)
    setServerError(null)

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const v = await fetchServerVersion(rawUrl)
        if (cancelled) return
        setServerVersion(v)
        setServerError(null)
        if (getScreepsmodAuth(v)) {
          const mod = await fetchAuthModInfo(rawUrl)
          if (!cancelled) setAuthModInfo(mod)
        }
      } catch {
        if (!cancelled) { setServerError('Could not reach server'); setServerVersion(null) }
      }
    }, 400)

    onCleanup(() => { cancelled = true; clearTimeout(timer) })
  })

  return { serverVersion, authModInfo, serverError }
}

// ── field availability check hook ─────────────────────────────────────────────

type AvailState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

function useAvailCheck(url: () => string, value: () => string, checker: (url: string, v: string) => Promise<{ ok?: number; error?: string }>) {
  const [state, setState] = createSignal<AvailState>('idle')

  createEffect(() => {
    const v = value()
    if (!v) { setState('idle'); return }

    setState('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await checker(url(), v)
        if (!cancelled) setState(res.error ? 'taken' : 'available')
      } catch {
        if (!cancelled) setState('error')
      }
    }, 500)

    onCleanup(() => { cancelled = true; clearTimeout(timer) })
  })

  return state
}

function FieldStatus(props: { state: AvailState }) {
  const map: Record<AvailState, { text: string; color: string } | null> = {
    idle: null,
    checking: { text: 'Checking…', color: '#8b949e' },
    available: { text: '✓ Available', color: '#3fb950' },
    taken: { text: '✗ Already taken', color: '#f85149' },
    error: { text: 'Could not verify', color: '#d29922' },
  }
  const info = () => map[props.state]
  return (
    <Show when={info()}>
      <span style={{ 'font-size': '11px', color: info()!.color }}>{info()!.text}</span>
    </Show>
  )
}

// ── registration form ──────────────────────────────────────────────────────────

function RegistrationForm(props: {
  url: string
  serverPassword: string
  onSuccess: (email: string, password: string) => void
  onCancel: () => void
}) {
  const [regUsername, setRegUsername] = createSignal('')
  const [regEmail, setRegEmail] = createSignal('')
  const [regPassword, setRegPassword] = createSignal('')
  const [regConfirm, setRegConfirm] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [regError, setRegError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)

  const usernameState = useAvailCheck(() => props.url, regUsername, checkUsername)
  const emailState = useAvailCheck(() => props.url, regEmail, checkEmail)

  const passwordMismatch = () => regConfirm() !== '' && regPassword() !== regConfirm()
  const canSubmit = () =>
    !submitting() &&
    regUsername() !== '' &&
    regEmail() !== '' &&
    regPassword().length >= 4 &&
    regPassword() === regConfirm() &&
    usernameState() !== 'taken' && usernameState() !== 'checking' &&
    emailState() !== 'taken' && emailState() !== 'checking'

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!canSubmit()) return
    setSubmitting(true)
    setRegError(null)
    try {
      const res = await registerUser(props.url, regUsername(), regEmail(), regPassword())
      if (res.error) { setRegError(res.error); return }
      setSuccess(true)
      setTimeout(() => props.onSuccess(regEmail(), regPassword()), 1500)
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, 'font-size': '20px' }}>Create Account</h2>

      <Show when={success()}>
        <div style={{ color: '#3fb950', 'font-size': '14px', 'text-align': 'center', padding: '8px 0' }}>
          Account created! Logging you in…
        </div>
      </Show>

      <Show when={!success()}>
        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px' }}>
            <span style={{ 'font-size': '12px', color: '#8b949e' }}>Username</span>
            <FieldStatus state={usernameState()} />
          </div>
          <input
            type="text"
            name="username"
            autocomplete="username"
            value={regUsername()}
            onInput={(e) => setRegUsername(e.currentTarget.value)}
            style={inputStyle}
            disabled={submitting()}
          />
        </label>

        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px' }}>
            <span style={{ 'font-size': '12px', color: '#8b949e' }}>Email</span>
            <FieldStatus state={emailState()} />
          </div>
          <input
            type="email"
            name="email"
            autocomplete="email"
            value={regEmail()}
            onInput={(e) => setRegEmail(e.currentTarget.value)}
            style={inputStyle}
            disabled={submitting()}
          />
        </label>

        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <span style={{ 'font-size': '12px', color: '#8b949e' }}>Password</span>
          <input
            type="password"
            name="new-password"
            autocomplete="new-password"
            value={regPassword()}
            onInput={(e) => setRegPassword(e.currentTarget.value)}
            style={inputStyle}
            disabled={submitting()}
          />
        </label>

        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px' }}>
            <span style={{ 'font-size': '12px', color: '#8b949e' }}>Confirm Password</span>
            <Show when={passwordMismatch()}>
              <span style={{ 'font-size': '11px', color: '#f85149' }}>Passwords don't match</span>
            </Show>
          </div>
          <input
            type="password"
            name="confirm-password"
            autocomplete="new-password"
            value={regConfirm()}
            onInput={(e) => setRegConfirm(e.currentTarget.value)}
            style={{
              ...inputStyle,
              border: passwordMismatch() ? '1px solid #f85149' : '1px solid #30363d',
            }}
            disabled={submitting()}
          />
        </label>

        {regError() && (
          <div style={{ color: '#f85149', 'font-size': '13px' }}>{regError()}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit()}
          style={{
            padding: '10px',
            'border-radius': '6px',
            border: 'none',
            background: '#238636',
            color: '#fff',
            'font-weight': 600,
            cursor: canSubmit() ? 'pointer' : 'not-allowed',
            opacity: canSubmit() ? 1 : 0.5,
          }}
        >
          {submitting() ? 'Creating account…' : 'Create Account'}
        </button>

        <button
          type="button"
          onClick={() => props.onCancel()}
          style={{
            padding: '8px',
            'border-radius': '6px',
            border: '1px solid #30363d',
            background: 'transparent',
            color: '#8b949e',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          Back to Login
        </button>
      </Show>
    </form>
  )
}

// ── main login form ────────────────────────────────────────────────────────────

export function LoginForm() {
  const embedded = isEmbedded()
  const xxscreeps = isXxscreepsMode()
  const [mode, setMode] = createSignal<'login' | 'register'>('login')
  const [authType, setAuthType] = createSignal<'password' | 'token'>('password')
  const [url, setUrl] = createSignal(embedded ? embeddedServerUrl() : window.location.origin)
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [token, setToken] = createSignal('')
  const [serverPassword, setServerPassword] = createSignal('')

  const { serverVersion, authModInfo, serverError } = useServerInfo(url)

  const welcomeText = () => serverVersion()?.serverData?.welcomeText ?? null
  const mods = () => (serverVersion()?.serverData?.features ?? []).filter(f => f.name !== 'auth' && f.version != null)
  const hasSteam = () => {
    const v = serverVersion()
    if (!v) return true
    return getScreepsmodAuth(v)?.authTypes?.includes('steam') ?? true
  }
  const canRegister = () =>
    authModInfo()?.allowRegistration === true ||
    (serverVersion()?.serverData?.features ?? []).some(f => f.name === 'official-like')

  const handleSteamLogin = () => {
    const serverUrl = url().replace(/\/$/, '')
    const popup = window.open(`${serverUrl}/api/auth/steam`, 'screeps-steam-auth', 'width=800,height=600,left=200,top=100')
    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { token?: string }
        if (data.token) { cleanup(); connect({ url: serverUrl, auth: 'token', token: data.token, serverPassword: serverPassword() || undefined, storage: null }) }
      } catch { /* non-JSON */ }
    }
    const checkClosed = setInterval(() => { if (popup?.closed) cleanup() }, 500)
    const cleanup = () => { clearInterval(checkClosed); window.removeEventListener('message', onMessage) }
    window.addEventListener('message', onMessage)
    onCleanup(cleanup)
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    await connect({ url: url(), auth: authType(), email: email() || undefined, password: password() || undefined, token: token() || undefined, serverPassword: serverPassword() || undefined, storage: null })
  }

  const handleGuestConnect = async (e: MouseEvent) => {
    e.preventDefault()
    await connect({ url: url(), auth: 'guest', serverPassword: serverPassword() || undefined, storage: null })
  }

  const handleRegistrationSuccess = async (regEmail: string, regPassword: string) => {
    try {
      await connect({
        url: url(),
        auth: 'password',
        email: regEmail,
        password: regPassword,
        serverPassword: serverPassword() || undefined,
        storage: null,
      })
    } catch {
      setMode('login')
      setAuthType('password')
      setEmail(regEmail)
      setPassword(regPassword)
    }
  }

  const isConnecting = () => status() === 'connecting'

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
        overflow: 'auto',
        padding: '24px 0',
        'box-sizing': 'border-box',
      }}
    >
      <Show when={welcomeText()}>
        <div
          style={{
            width: '360px',
            padding: '16px 20px',
            'border-radius': '8px',
            background: '#161b22',
            border: '1px solid #30363d',
            color: '#c9d1d9',
            'font-size': '13px',
            'line-height': '1.6',
          }}
          // eslint-disable-next-line solid/no-innerhtml
          innerHTML={welcomeText()!}
        />
      </Show>

      <div
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
        <Show when={mode() === 'register'}>
          <RegistrationForm
            url={url()}
            serverPassword={serverPassword()}
            onSuccess={handleRegistrationSuccess}
            onCancel={() => setMode('login')}
          />
        </Show>

        <Show when={mode() === 'login'}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
            <div style={{ display: 'flex', 'align-items': 'baseline', 'justify-content': 'space-between' }}>
              <h2 style={{ margin: 0, 'font-size': '20px' }}>Connect to Screeps</h2>
              <Show when={canRegister()}>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#58a6ff',
                    'font-size': '12px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Create account
                </button>
              </Show>
            </div>

            <Show when={!embedded}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setAuthType('password')} style={{ flex: 1, padding: '8px', 'border-radius': '6px', border: '1px solid #30363d', background: authType() === 'password' ? '#238636' : 'transparent', color: '#fff', cursor: 'pointer' }}>
                  Password
                </button>
                <button type="button" onClick={() => setAuthType('token')} style={{ flex: 1, padding: '8px', 'border-radius': '6px', border: '1px solid #30363d', background: authType() === 'token' ? '#238636' : 'transparent', color: '#fff', cursor: 'pointer' }}>
                  Token
                </button>
              </div>
            </Show>

            <Show when={!embedded}>
              <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                <span style={{ 'font-size': '12px', color: '#8b949e' }}>Server URL</span>
                <input type="url" name="url" autocomplete="url" inputmode="url" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} style={inputStyle} />
              </label>
              <Show when={serverError()}>
                <div style={{ color: '#8b949e', 'font-size': '12px', 'margin-top': '-8px' }}>{serverError()}</div>
              </Show>
            </Show>

            {authType() === 'password' ? (
              <>
                <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                  <span style={{ 'font-size': '12px', color: '#8b949e' }}>Email or Username</span>
                  <input type="text" id="username" name="username" autocomplete="username" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                  <span style={{ 'font-size': '12px', color: '#8b949e' }}>Password</span>
                  <input type="password" id="password" name="password" autocomplete="current-password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} style={inputStyle} />
                </label>
              </>
            ) : (
              <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                <span style={{ 'font-size': '12px', color: '#8b949e' }}>Auth Token</span>
                <input type="password" name="token" autocomplete="off" value={token()} onInput={(e) => setToken(e.currentTarget.value)} style={inputStyle} />
              </label>
            )}

            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Server Password <span style={{ color: '#484f58' }}>(optional)</span></span>
              <input type="password" name="server-password" autocomplete="off" data-1p-ignore data-lpignore="true" value={serverPassword()} onInput={(e) => setServerPassword(e.currentTarget.value)} placeholder="Leave empty if not required" style={inputStyle} />
            </label>

            {error() && <div style={{ color: '#f85149', 'font-size': '13px' }}>{error()}</div>}

            <button
              type="submit"
              disabled={isConnecting()}
              style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#238636', color: '#fff', 'font-weight': 600, cursor: isConnecting() ? 'not-allowed' : 'pointer', opacity: isConnecting() ? 0.6 : 1 }}
            >
              {isConnecting() ? 'Connecting…' : 'Connect'}
            </button>

            <Show when={hasSteam()}>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', color: '#484f58', 'font-size': '12px' }}>
                <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
                or
                <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
              </div>
              <button type="button" disabled={isConnecting()} onClick={handleSteamLogin} style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#1b2838', color: '#c7d5e0', 'font-weight': 600, cursor: isConnecting() ? 'not-allowed' : 'pointer', opacity: isConnecting() ? 0.6 : 1 }}>
                Login with Steam
              </button>
            </Show>

            <Show when={!embedded || xxscreeps}>
              <button
                type="button"
                disabled={isConnecting()}
                onClick={handleGuestConnect}
                style={{ padding: '8px', 'border-radius': '6px', border: '1px solid #30363d', background: 'transparent', color: '#8b949e', 'font-size': '12px', cursor: isConnecting() ? 'not-allowed' : 'pointer', opacity: isConnecting() ? 0.6 : 1 }}
                onMouseEnter={(e) => { if (!isConnecting()) e.currentTarget.style.borderColor = '#8b949e' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#30363d' }}
              >
                Connect as Guest (read-only)
              </button>
            </Show>
          </form>
        </Show>
      </div>

      <Show when={mods().length > 0}>
        <div style={{ width: '360px', padding: '12px 20px', 'border-radius': '8px', background: '#161b22', border: '1px solid #30363d' }}>
          <div style={{ 'font-size': '11px', color: '#484f58', 'margin-bottom': '8px', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>
            Server Mods
          </div>
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
            <For each={mods()}>
              {(f) => (
                <span style={{ 'font-size': '11px', padding: '2px 8px', 'border-radius': '12px', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', 'font-family': 'monospace' }}>
                  {f.name}{f.version ? ` ${f.version}` : ''}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
