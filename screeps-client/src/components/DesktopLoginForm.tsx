import { createSignal, createEffect, on, onCleanup, onMount, untrack, For, Show, Switch, Match } from 'solid-js'
import { Plus, Pencil, Trash2 } from 'lucide-solid'
import { connect, status, error } from '~/stores/clientStore.js'
import { createLogger } from '~/utils/log.js'

const { log } = createLogger('desktop-login')
import {
  type ServerConfig,
  BUILTIN_SERVERS,
  getAllServers,
  addUserServer,
  removeUserServer,
  updateUserServer,
  getLastSelectedServerId,
  setLastSelectedServerId,
} from '~/utils/serverList.js'
import {
  saveSavedCredential,
  loadSavedCredential,
  deleteSavedCredential,
} from '~/utils/keychain.js'
import { fetchServerVersion, getScreepsmodAuth } from 'screeps-connectivity'
import type { ServerVersion } from 'screeps-connectivity'
import { useOAuthLogin } from '~/utils/useOAuthLogin.js'
import { OAuthUsernameForm } from './OAuthUsernameForm.js'

// ── styles ─────────────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '8px 12px',
  'border-radius': '6px',
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#c9d1d9',
  width: '100%',
  'box-sizing': 'border-box',
} as const

// ── server info hook ───────────────────────────────────────────────────────────

function useServerInfo(url: () => string) {
  const [serverVersion, setServerVersion] = createSignal<ServerVersion | null>(null)
  const [serverError, setServerError] = createSignal<string | null>(null)

  createEffect(() => {
    const rawUrl = url()
    setServerVersion(null)
    setServerError(null)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const v = await fetchServerVersion(rawUrl)
        if (!cancelled) { setServerVersion(v); setServerError(null) }
      } catch {
        if (!cancelled) setServerError('Could not reach server')
      }
    }, 400)
    onCleanup(() => { cancelled = true; clearTimeout(timer) })
  })

  return { serverVersion, serverError }
}

// ── server list sidebar ────────────────────────────────────────────────────────

function ServerList(props: {
  servers: ServerConfig[]
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (server: ServerConfig) => void
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  const [hoveredId, setHoveredId] = createSignal<string | null>(null)

  const hostname = (url: string) => {
    try { return new URL(url).hostname }
    catch { return url }
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%', gap: '8px' }}>
      <div style={{ 'font-size': '11px', color: '#484f58', 'text-transform': 'uppercase', 'letter-spacing': '0.05em', 'font-weight': 600, 'padding-bottom': '4px' }}>
        Servers
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
        <For each={props.servers}>
          {(server) => {
            const isSelected = () => props.selectedId === server.id
            const isHovered = () => hoveredId() === server.id

            return (
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  padding: '8px 10px',
                  'border-radius': '6px',
                  cursor: 'pointer',
                  background: isSelected() ? '#1f6feb20' : isHovered() ? '#1c2128' : 'transparent',
                  border: `1px solid ${isSelected() ? '#1f6feb60' : 'transparent'}`,
                  gap: '6px',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onClick={() => props.onSelect(server.id)}
                onMouseEnter={() => setHoveredId(server.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div style={{ flex: 1, 'min-width': 0 }}>
                  <div style={{
                    'font-size': '13px',
                    color: isSelected() ? '#58a6ff' : '#c9d1d9',
                    'font-weight': isSelected() ? '500' : 'normal',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                  }}>
                    {server.name}
                  </div>
                  <div style={{
                    'font-size': '10px',
                    color: '#484f58',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    'margin-top': '1px',
                  }}>
                    {hostname(server.url)}
                  </div>
                </div>

                <Show when={!server.builtin && isHovered()}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); props.onEdit(server) }}
                    title="Edit"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: '2px', display: 'flex', 'align-items': 'center', 'border-radius': '4px', 'flex-shrink': 0 }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); props.onDelete(server.id) }}
                    title="Remove"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f85149', padding: '2px', display: 'flex', 'align-items': 'center', 'border-radius': '4px', 'flex-shrink': 0 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </Show>
              </div>
            )
          }}
        </For>
      </div>

      <button
        type="button"
        onClick={() => props.onAdd()}
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '6px',
          padding: '8px 10px',
          'border-radius': '6px',
          border: '1px dashed #30363d',
          background: 'transparent',
          color: '#8b949e',
          'font-size': '12px',
          cursor: 'pointer',
          'flex-shrink': 0,
        }}
      >
        <Plus size={12} /> Add Server
      </button>
    </div>
  )
}

// ── per-server login form ──────────────────────────────────────────────────────

function ServerLoginForm(props: { server: ServerConfig }) {
  const [authType, setAuthType] = createSignal<'password' | 'token'>(
    untrack(() => (props.server.forcedAuth === 'token' ? 'token' : 'password'))
  )
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [token, setToken] = createSignal('')
  const [serverPassword, setServerPassword] = createSignal('')
  const [saveCredentials, setSaveCredentials] = createSignal(false)
  const [credentialSaved, setCredentialSaved] = createSignal(false)

  const effectiveAuth = () => props.server.forcedAuth ?? authType()

  async function applyLoadedCredential(url: string) {
    log(`applyLoadedCredential: loading for "${url}"`)
    const saved = await loadSavedCredential(url)
    log(`applyLoadedCredential: result for "${url}" →`, saved !== null ? '[found]' : '[not found]')
    if (saved !== null) {
      setCredentialSaved(true)
      setSaveCredentials(true)
      const auth = effectiveAuth()
      log(`applyLoadedCredential: applying to field, effectiveAuth="${auth}"`)
      if (auth === 'token') setToken(saved)
      else setPassword(saved)
    }
  }

  onMount(() => {
    log(`ServerLoginForm mounted, server="${props.server.url}"`)
    void applyLoadedCredential(props.server.url)
  })

  createEffect(on(() => props.server.id, () => {
    setEmail('')
    setPassword('')
    setToken('')
    setServerPassword('')
    setCredentialSaved(false)
    setSaveCredentials(false)
    setAuthType(props.server.forcedAuth === 'token' ? 'token' : 'password')
    void applyLoadedCredential(props.server.url)
  }, { defer: true }))

  const { serverVersion, serverError } = useServerInfo(() => props.server.url)

  const showToggle = () => !props.server.forcedAuth

  const hasSteam = () => {
    if (props.server.forcedAuth) return false
    const v = serverVersion()
    if (!v) return true
    return getScreepsmodAuth(v)?.authTypes?.includes('steam') ?? true
  }

  const isConnecting = () => status() === 'connecting'

  const handleSaveCredentialsChange = async (checked: boolean) => {
    setSaveCredentials(checked)
    if (!checked && credentialSaved()) {
      await deleteSavedCredential(props.server.url)
      setCredentialSaved(false)
      if (effectiveAuth() === 'token') setToken('')
      else setPassword('')
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const auth = effectiveAuth()
    const credential = auth === 'token' ? token() : auth === 'password' ? password() : null
    const willSave = saveCredentials() && !credentialSaved() && credential !== null && credential !== ''
    log(`handleSubmit: auth="${auth}" saveCredentials=${saveCredentials()} credentialSaved=${credentialSaved()} willSave=${willSave} credential=${credential !== null && credential !== '' ? '[present]' : '[empty]'}`)

    if (willSave) {
      log(`handleSubmit: saving credential for "${props.server.url}"`)
      await saveSavedCredential(props.server.url, credential!)
      setCredentialSaved(true)
      log(`handleSubmit: credential saved`)
    }

    try {
      await connect({
        url: props.server.url,
        auth,
        email: email() || undefined,
        password: password() || undefined,
        token: token() || undefined,
        serverPassword: serverPassword() || undefined,
        storage: null,
      })
    } catch {
      if (willSave) {
        log(`handleSubmit: connect failed, removing saved credential`)
        void deleteSavedCredential(props.server.url)
        setCredentialSaved(false)
      }
    }
  }

  const steamLogin = useOAuthLogin('steam', ({ url: steamUrl, token }) => {
    void connect({ url: steamUrl, auth: 'token', authMethod: 'steam', token, serverPassword: serverPassword() || undefined, storage: null })
  })
  const handleSteamLogin = () => steamLogin.startLogin(props.server.url)

  return (
    <Show when={!steamLogin.pending()} fallback={
      <OAuthUsernameForm
        url={steamLogin.pending()!.url}
        providerLabel="Steam"
        submitting={steamLogin.submitting()}
        error={steamLogin.regError()}
        onSubmit={(username, regEmail) => void steamLogin.completeRegistration(username, regEmail)}
        onCancel={() => steamLogin.cancelRegistration()}
      />
    }>
    <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', 'font-size': '18px', color: '#c9d1d9' }}>{props.server.name}</h2>
        <div style={{ 'font-size': '11px', color: '#484f58' }}>{props.server.url}</div>
        <Show when={serverError()}>
          <div style={{ 'font-size': '12px', color: '#d29922', 'margin-top': '4px' }}>{serverError()}</div>
        </Show>
      </div>

      <Show when={showToggle()}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setAuthType('password')}
            style={{ flex: 1, padding: '8px', 'border-radius': '6px', border: '1px solid #30363d', background: authType() === 'password' ? '#238636' : 'transparent', color: '#fff', cursor: 'pointer', 'font-size': '13px' }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthType('token')}
            style={{ flex: 1, padding: '8px', 'border-radius': '6px', border: '1px solid #30363d', background: authType() === 'token' ? '#238636' : 'transparent', color: '#fff', cursor: 'pointer', 'font-size': '13px' }}
          >
            Token
          </button>
        </div>
      </Show>

      <Show when={effectiveAuth() !== 'guest'}>
        <Show
          when={effectiveAuth() === 'password'}
          fallback={
            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Auth Token</span>
              <input
                type="password"
                name="token"
                autocomplete="off"
                value={token()}
                onInput={(e) => setToken(e.currentTarget.value)}
                disabled={credentialSaved()}
                style={{ ...inputStyle, opacity: credentialSaved() ? 0.5 : 1, cursor: credentialSaved() ? 'not-allowed' : 'text' }}
              />
            </label>
          }
        >
          <>
            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Email or Username</span>
              <input type="text" name="username" autocomplete="username" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <span style={{ 'font-size': '12px', color: '#8b949e' }}>Password</span>
              <input
                type="password"
                name="password"
                autocomplete="current-password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={credentialSaved()}
                style={{ ...inputStyle, opacity: credentialSaved() ? 0.5 : 1, cursor: credentialSaved() ? 'not-allowed' : 'text' }}
              />
            </label>
          </>
        </Show>

        <label style={{ display: 'flex', 'align-items': 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={saveCredentials()}
            onChange={(e) => { void handleSaveCredentialsChange(e.currentTarget.checked) }}
            style={{ width: '14px', height: '14px', 'accent-color': '#238636', cursor: 'pointer', 'flex-shrink': 0 }}
          />
          <span style={{ 'font-size': '13px', color: '#8b949e' }}>
            Save {effectiveAuth() === 'token' ? 'token' : 'password'} in keychain
          </span>
        </label>
      </Show>

      <Show when={props.server.hasServerPassword !== false}>
        <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <span style={{ 'font-size': '12px', color: '#8b949e' }}>
            Server Password <span style={{ color: '#484f58' }}>(optional)</span>
          </span>
          <input
            type="password"
            name="server-password"
            autocomplete="off"
            data-1p-ignore
            data-lpignore="true"
            value={serverPassword()}
            onInput={(e) => setServerPassword(e.currentTarget.value)}
            placeholder="Leave empty if not required"
            style={inputStyle}
          />
        </label>
      </Show>

      <Show when={error()}>
        <div style={{ color: '#f85149', 'font-size': '13px' }}>{error()}</div>
      </Show>

      <button
        type="submit"
        disabled={isConnecting()}
        style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#238636', color: '#fff', 'font-weight': 600, cursor: isConnecting() ? 'not-allowed' : 'pointer', opacity: isConnecting() ? 0.6 : 1 }}
      >
        {isConnecting() ? 'Connecting…' : effectiveAuth() === 'guest' ? 'Connect as Guest (read-only)' : 'Connect'}
      </button>

      <Show when={hasSteam()}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', color: '#484f58', 'font-size': '12px' }}>
          <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
          or
          <div style={{ flex: 1, height: '1px', background: '#30363d' }} />
        </div>
        <button
          type="button"
          disabled={isConnecting()}
          onClick={handleSteamLogin}
          style={{ padding: '10px', 'border-radius': '6px', border: 'none', background: '#1b2838', color: '#c7d5e0', 'font-weight': 600, cursor: isConnecting() ? 'not-allowed' : 'pointer', opacity: isConnecting() ? 0.6 : 1 }}
        >
          Login with Steam
        </button>
      </Show>
    </form>
    </Show>
  )
}

// ── add / edit server form ─────────────────────────────────────────────────────

function ServerEditForm(props: {
  server?: ServerConfig
  onSave: (server: ServerConfig) => void
  onCancel: () => void
}) {
  const isEdit = () => !!props.server

  const [name, setName] = createSignal(untrack(() => props.server?.name ?? ''))
  const [url, setUrl] = createSignal(untrack(() => props.server?.url ?? ''))
  const [forcedAuth, setForcedAuth] = createSignal<'password' | 'token' | 'guest' | ''>(
    untrack(() => props.server?.forcedAuth ?? '')
  )
  const [hasServerPassword, setHasServerPassword] = createSignal(
    untrack(() => props.server?.hasServerPassword ?? true)
  )

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const trimmedUrl = url().trim().replace(/\/$/, '')
    if (!name().trim() || !trimmedUrl) return

    const fa = forcedAuth()
    const config: Omit<ServerConfig, 'id' | 'builtin'> = {
      name: name().trim(),
      url: trimmedUrl,
      forcedAuth: fa !== '' ? fa : undefined,
      hasServerPassword: hasServerPassword(),
    }

    if (isEdit() && props.server) {
      updateUserServer(props.server.id, config)
      props.onSave({ ...props.server, ...config })
    } else {
      props.onSave(addUserServer(config))
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, 'font-size': '18px', color: '#c9d1d9' }}>
        {isEdit() ? 'Edit Server' : 'Add Server'}
      </h2>

      <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
        <span style={{ 'font-size': '12px', color: '#8b949e' }}>Name</span>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          style={inputStyle}
          placeholder="My Private Server"
          required
        />
      </label>

      <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
        <span style={{ 'font-size': '12px', color: '#8b949e' }}>Server URL</span>
        <input
          type="url"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          style={inputStyle}
          placeholder="https://example.com"
          required
        />
      </label>

      <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
        <span style={{ 'font-size': '12px', color: '#8b949e' }}>Auth Method</span>
        <span style={{ 'font-size': '11px', color: '#484f58', 'margin-bottom': '2px' }}>Restrict available login options for this server</span>
        <select
          value={forcedAuth()}
          onChange={(e) => setForcedAuth(e.currentTarget.value as 'password' | 'token' | 'guest' | '')}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">Auto-detect (show all options)</option>
          <option value="token">Token only</option>
          <option value="password">Password only</option>
          <option value="guest">Guest only (read-only)</option>
        </select>
      </label>

      <label style={{ display: 'flex', 'align-items': 'center', gap: '10px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={hasServerPassword()}
          onChange={(e) => setHasServerPassword(e.currentTarget.checked)}
          style={{ width: '14px', height: '14px', 'accent-color': '#238636', cursor: 'pointer', 'flex-shrink': 0 }}
        />
        <span style={{ 'font-size': '13px', color: '#c9d1d9' }}>Server requires a connection password</span>
      </label>

      <div style={{ display: 'flex', gap: '8px', 'margin-top': '4px' }}>
        <button
          type="submit"
          style={{ flex: 1, padding: '10px', 'border-radius': '6px', border: 'none', background: '#238636', color: '#fff', 'font-weight': 600, cursor: 'pointer' }}
        >
          {isEdit() ? 'Save Changes' : 'Add Server'}
        </button>
        <button
          type="button"
          onClick={() => props.onCancel()}
          style={{ flex: 1, padding: '10px', 'border-radius': '6px', border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── main desktop login form ────────────────────────────────────────────────────

export function DesktopLoginForm() {
  const getInitialId = () => {
    const lastId = getLastSelectedServerId()
    if (lastId && getAllServers().some(s => s.id === lastId)) return lastId
    return BUILTIN_SERVERS[0].id
  }

  const [servers, setServers] = createSignal(getAllServers())
  const [selectedId, setSelectedId] = createSignal<string | null>(getInitialId())
  const [panel, setPanel] = createSignal<'login' | 'add' | 'edit'>('login')
  const [editTarget, setEditTarget] = createSignal<ServerConfig | null>(null)

  const selectedServer = () => servers().find(s => s.id === selectedId()) ?? null

  const refreshServers = () => setServers(getAllServers())

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setLastSelectedServerId(id)
    setPanel('login')
  }

  const handleAdd = () => {
    setSelectedId(null)
    setPanel('add')
  }

  const handleEdit = (server: ServerConfig) => {
    setEditTarget(server)
    setPanel('edit')
  }

  const handleDelete = (id: string) => {
    removeUserServer(id)
    refreshServers()
    if (selectedId() === id) handleSelect(BUILTIN_SERVERS[0].id)
  }

  const handleServerSaved = (server: ServerConfig) => {
    refreshServers()
    handleSelect(server.id)
  }

  const handleCancelEdit = () => {
    if (panel() === 'edit' && editTarget()) {
      setSelectedId(editTarget()!.id)
    } else {
      setSelectedId(selectedId() ?? BUILTIN_SERVERS[0].id)
    }
    setPanel('login')
  }

  return (
    <div style={{
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'center',
      'justify-content': 'center',
      width: '100%',
      height: '100%',
      overflow: 'auto',
      padding: '24px',
      'box-sizing': 'border-box',
    }}>
      <div style={{
        display: 'flex',
        width: '680px',
        'min-height': '420px',
        'border-radius': '8px',
        background: '#161b22',
        border: '1px solid #30363d',
        overflow: 'hidden',
        'flex-shrink': 0,
      }}>
        {/* Server list */}
        <div style={{
          width: '200px',
          'min-width': '200px',
          'border-right': '1px solid #30363d',
          padding: '24px 16px',
          'box-sizing': 'border-box',
          display: 'flex',
          'flex-direction': 'column',
        }}>
          <ServerList
            servers={servers()}
            selectedId={selectedId()}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        </div>

        {/* Right panel */}
        <div style={{
          flex: 1,
          padding: '28px 32px',
          'box-sizing': 'border-box',
          overflow: 'auto',
        }}>
          <Switch>
            <Match when={panel() === 'add'}>
              <ServerEditForm
                onSave={handleServerSaved}
                onCancel={handleCancelEdit}
              />
            </Match>
            <Match when={panel() === 'edit' ? editTarget() : null}>
              {(target) => (
                <ServerEditForm
                  server={target()}
                  onSave={handleServerSaved}
                  onCancel={handleCancelEdit}
                />
              )}
            </Match>
            <Match when={panel() === 'login' ? selectedServer() : null}>
              {(server) => <ServerLoginForm server={server()} />}
            </Match>
            <Match when={true}>
              <div style={{ color: '#484f58', 'text-align': 'center', 'padding-top': '60px', 'font-size': '14px' }}>
                Select a server from the list
              </div>
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
