// Shared building blocks for the two login screens (LoginForm for the web
// client, DesktopLoginForm for the desktop/proxy server-list flow): input
// styles, the password/token toggle, the server-password field, the connect
// button, the Steam/Discord buttons, and the server capability probes they
// both derive from a fetched ServerVersion.
import { Show } from 'solid-js'
import type { ServerVersion } from 'screeps-connectivity'
import {
  getScreepsmodAuth,
  getXxscreepsModClientFeature,
  getDiscordFeature,
  hasOfficialLike,
} from 'screeps-connectivity'

export const inputStyle = {
  padding: '8px 12px',
  'border-radius': '6px',
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#c9d1d9',
} as const

export const fieldColumnStyle = { display: 'flex', 'flex-direction': 'column', gap: '4px' } as const
export const fieldNameStyle = { 'font-size': '12px', color: '#8b949e' } as const

// ── server capability probes ──────────────────────────────────────────────────
// The xxscreeps-mod-client feature (reflecting `.screepsrc.yaml`) takes priority
// over the generic screepsmod-auth / official-like heuristics.

export function serverHasSteam(v: ServerVersion | null): boolean {
  if (!v) return true
  const caps = getXxscreepsModClientFeature(v)
  if (caps) return caps.steamLogin
  return getScreepsmodAuth(v)?.authTypes?.includes('steam') ?? true
}

export function serverHasDiscord(v: ServerVersion | null): boolean {
  return v ? getDiscordFeature(v)?.discordLogin ?? false : false
}

// The connection ("server") password is a screepsmod-auth-only concept. xxscreeps
// servers (advertised via the `official-like` feature) have no such setting.
export function serverShowsServerPassword(v: ServerVersion | null): boolean {
  return v ? !hasOfficialLike(v) : true
}

// ── shared form pieces ────────────────────────────────────────────────────────

export function AuthTypeToggle(props: {
  value: 'password' | 'token'
  onChange: (t: 'password' | 'token') => void
  fontSize?: string
}) {
  const btnStyle = (t: 'password' | 'token') => ({
    flex: 1,
    padding: '8px',
    'border-radius': '6px',
    border: '1px solid #30363d',
    background: props.value === t ? '#238636' : 'transparent',
    color: '#fff',
    cursor: 'pointer',
    ...(props.fontSize ? { 'font-size': props.fontSize } : {}),
  })
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button type="button" onClick={() => props.onChange('password')} style={btnStyle('password')}>
        Password
      </button>
      <button type="button" onClick={() => props.onChange('token')} style={btnStyle('token')}>
        Token
      </button>
    </div>
  )
}

export function ServerPasswordField(props: { value: string; onInput: (v: string) => void }) {
  return (
    <label style={fieldColumnStyle}>
      <span style={fieldNameStyle}>
        Server Password <span style={{ color: '#484f58' }}>(optional)</span>
      </span>
      <input
        type="password"
        name="server-password"
        autocomplete="off"
        data-1p-ignore
        data-lpignore="true"
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder="Leave empty if not required"
        style={inputStyle}
      />
    </label>
  )
}

export function ErrorText(props: { error: string | null | undefined }) {
  return (
    <Show when={props.error}>
      <div style={{ color: '#f85149', 'font-size': '13px' }}>{props.error}</div>
    </Show>
  )
}

export function ConnectButton(props: { connecting: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={props.connecting}
      style={{
        padding: '10px',
        'border-radius': '6px',
        border: 'none',
        background: '#238636',
        color: '#fff',
        'font-weight': 600,
        cursor: props.connecting ? 'not-allowed' : 'pointer',
        opacity: props.connecting ? 0.6 : 1,
      }}
    >
      {props.connecting ? 'Connecting…' : props.label ?? 'Connect'}
    </button>
  )
}

/** "or" divider plus the Steam/Discord login buttons, shown only when available. */
export function OAuthButtons(props: {
  hasSteam: boolean
  hasDiscord: boolean
  disabled: boolean
  onSteam: () => void
  onDiscord: () => void
}) {
  return (
    <>
      <Show when={props.hasSteam || props.hasDiscord}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', color: '#484f58', 'font-size': '12px' }}>
          <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
          or
          <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
        </div>
      </Show>
      <Show when={props.hasSteam}>
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => props.onSteam()}
          style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#1b2838', color: '#c7d5e0', 'font-weight': 600, cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1 }}
        >
          Login with Steam
        </button>
      </Show>
      <Show when={props.hasDiscord}>
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => props.onDiscord()}
          style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#5865F2', color: '#fff', 'font-weight': 600, cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1 }}
        >
          Login with Discord
        </button>
      </Show>
    </>
  )
}
