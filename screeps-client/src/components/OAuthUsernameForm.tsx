import { createSignal, createEffect, onCleanup, Show, JSX } from 'solid-js'
import { Check, X as XIcon } from 'lucide-solid'
import { checkUsername } from 'screeps-connectivity'

const inputStyle = {
  padding: '8px 12px',
  'border-radius': '6px',
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#c9d1d9',
  width: '100%',
  'box-sizing': 'border-box',
} as const

type AvailState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

function useUsernameCheck(url: () => string, value: () => string) {
  const [state, setState] = createSignal<AvailState>('idle')

  createEffect(() => {
    const v = value()
    if (!v) { setState('idle'); return }

    setState('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(url(), v)
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
  const map: Record<AvailState, { children: JSX.Element; color: string } | null> = {
    idle: null,
    checking: { children: 'Checking…', color: '#8b949e' },
    available: { children: <><Check size={12} /> Available</>, color: '#3fb950' },
    taken: { children: <><XIcon size={12} /> Already taken</>, color: '#f85149' },
    error: { children: 'Could not verify', color: '#d29922' },
  }
  const info = () => map[props.state]
  return (
    <Show when={info()}>
      <span style={{
        'font-size': '11px', color: info()!.color,
        display: 'inline-flex', 'align-items': 'center', gap: '3px',
      }}>{info()!.children}</span>
    </Show>
  )
}

/** Shown after an OAuth login popup (Steam, Discord, GitHub, ...) returns a provisional token for a brand-new account. */
export function OAuthUsernameForm(props: {
  url: string
  /** Display name of the provider the user just signed in with, e.g. "Steam" or "Discord". */
  providerLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (username: string, email?: string) => void
  onCancel: () => void
}) {
  const [username, setUsername] = createSignal('')
  const [email, setEmail] = createSignal('')

  const usernameState = useUsernameCheck(() => props.url, username)

  const canSubmit = () =>
    !props.submitting &&
    username() !== '' &&
    usernameState() !== 'taken' && usernameState() !== 'checking'

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    if (!canSubmit()) return
    props.onSubmit(username(), email() || undefined)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, 'font-size': '20px' }}>Finish creating your account</h2>
      <div style={{ 'font-size': '13px', color: '#8b949e' }}>
        Signed in with {props.providerLabel} — choose a username to finish setting up your account.
      </div>

      <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
        <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px' }}>
          <span style={{ 'font-size': '12px', color: '#8b949e' }}>Username</span>
          <FieldStatus state={usernameState()} />
        </div>
        <input
          type="text"
          name="username"
          autocomplete="username"
          autofocus
          value={username()}
          onInput={(e) => setUsername(e.currentTarget.value)}
          style={inputStyle}
          disabled={props.submitting}
        />
      </label>

      <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
        <span style={{ 'font-size': '12px', color: '#8b949e' }}>Email <span style={{ color: '#484f58' }}>(optional)</span></span>
        <input
          type="email"
          name="email"
          autocomplete="email"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
          style={inputStyle}
          disabled={props.submitting}
        />
      </label>

      {props.error && (
        <div style={{ color: '#f85149', 'font-size': '13px' }}>{props.error}</div>
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
        {props.submitting ? 'Creating account…' : 'Continue'}
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
        Cancel
      </button>
    </form>
  )
}
