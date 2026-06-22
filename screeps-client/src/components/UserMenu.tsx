import { createSignal, createMemo, createEffect, onCleanup, Show, type JSX } from 'solid-js'
import { ChevronDown, KeyRound, LogOut, RotateCcw, Settings } from 'lucide-solid'
import { badgeToSvg } from 'screeps-connectivity'
import { authMethod, client, disconnect, userInfo } from '~/stores/clientStore.js'
import { addToast } from '~/stores/toastStore.js'

export function UserMenu(props: { onOpenSettings: () => void }) {
  const [open, setOpen] = createSignal(false)
  const [showRespawnConfirm, setShowRespawnConfirm] = createSignal(false)
  const [respawning, setRespawning] = createSignal(false)
  const [showPasswordDialog, setShowPasswordDialog] = createSignal(false)
  const [oldPassword, setOldPassword] = createSignal('')
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [changingPassword, setChangingPassword] = createSignal(false)

  // Setting/changing a password needs an interactive session (password or steam login).
  // A pasted API token can't manage the account; guests have no account.
  const canManagePassword = () => authMethod() === 'password' || authMethod() === 'steam'
  // Steam-only accounts have no password yet → "Set password" without a current-password field.
  const hasPassword = () => userInfo()?.password === true

  const passwordError = createMemo(() => {
    if (hasPassword() && oldPassword().length === 0) return 'Enter your current password.'
    if (newPassword().length < 8) return 'New password must be at least 8 characters.'
    if (newPassword() !== confirmPassword()) return "Passwords don't match."
    return null
  })

  let containerRef: HTMLDivElement | undefined

  const badgeSrc = createMemo(() => {
    const badge = userInfo()?.badge
    if (!badge) return null
    return `data:image/svg+xml,${encodeURIComponent(badgeToSvg(badge))}`
  })

  createEffect(() => {
    if (!open()) return
    const onPointer = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    })
  })

  function confirmRespawn() {
    const c = client()
    if (!c) return
    setRespawning(true)
    c.http.user.respawn()
      .then(() => {
        addToast('Respawn successful', 'success')
        void c.stores.user.refreshWorldStatus()
      })
      .catch((err: Error) => addToast(`Respawn failed: ${err.message}`, 'error'))
      .finally(() => {
        setRespawning(false)
        setShowRespawnConfirm(false)
      })
  }

  function openPasswordDialog() {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordDialog(true)
  }

  function submitPasswordChange() {
    const c = client()
    if (!c || passwordError()) return
    const setting = !hasPassword()
    setChangingPassword(true)
    // xxscreeps requires oldPassword in the body; for password-less (steam) accounts it is
    // ignored server-side, so an empty string is fine when setting a password for the first time.
    c.http.user.password(newPassword(), oldPassword())
      .then(() => {
        addToast(setting ? 'Password set' : 'Password changed', 'success')
        setShowPasswordDialog(false)
        if (setting) void c.stores.user.refreshMe()
      })
      .catch((err: Error) => addToast(`Password ${setting ? 'setup' : 'change'} failed: ${err.message}`, 'error'))
      .finally(() => setChangingPassword(false))
  }

  return (
    <div ref={(el) => containerRef = el} style={{ position: 'relative', margin: '0 16px 0 8px' }}>
      <button
        title="Account"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '5px 8px',
          'border-radius': '4px',
          border: '1px solid #30363d',
          background: open() ? '#21262d' : '#161b22',
          color: '#c9d1d9',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          gap: '6px',
          'font-size': '13px',
        }}
      >
        <Show when={badgeSrc()}>
          <img src={badgeSrc()!} width={20} height={20} style={{ display: 'block', 'border-radius': '3px' }} />
        </Show>
        <span style={{ 'font-weight': 600, 'max-width': '160px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
          {userInfo()?.username ?? '…'}
        </span>
        <ChevronDown size={14} />
      </button>

      <Show when={open()}>
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: '0',
            'min-width': '180px',
            background: '#161b22',
            border: '1px solid #30363d',
            'border-radius': '6px',
            'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
            'z-index': 100,
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          <MenuItem
            onClick={() => {
              setOpen(false)
              props.onOpenSettings()
            }}
          >
            <Settings size={15} />
            <span>Settings</span>
          </MenuItem>
          <Show when={canManagePassword()}>
            <MenuItem
              onClick={() => {
                setOpen(false)
                openPasswordDialog()
              }}
            >
              <KeyRound size={15} />
              <span>{hasPassword() ? 'Change password' : 'Set password'}</span>
            </MenuItem>
          </Show>
          <MenuItem
            onClick={() => {
              setOpen(false)
              setShowRespawnConfirm(true)
            }}
          >
            <RotateCcw size={15} />
            <span>Respawn</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false)
              disconnect()
            }}
            danger
          >
            <LogOut size={15} />
            <span>Logout</span>
          </MenuItem>
        </div>
      </Show>

      <Show when={showRespawnConfirm()}>
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.65)',
            'z-index': 200,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !respawning()) setShowRespawnConfirm(false)
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
              Respawn?
            </div>
            <p style={{ 'font-size': '13px', color: '#c9d1d9', 'line-height': '1.5', margin: '0 0 10px' }}>
              All your buildings and creeps will become unowned so that you can reset your spawn in any
              vacant room on the map.
            </p>
            <p style={{ 'font-size': '13px', color: '#8b949e', 'line-height': '1.5', margin: '0 0 18px' }}>
              <b style={{ color: '#c9d1d9' }}>Note:</b> you will NOT be able to spawn again in the same
              room within 3 days of the initial spawn placement.
            </p>
            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowRespawnConfirm(false)}
                disabled={respawning()}
                style={{
                  padding: '7px 14px',
                  'border-radius': '4px',
                  border: '1px solid #30363d',
                  background: '#21262d',
                  color: '#c9d1d9',
                  cursor: respawning() ? 'default' : 'pointer',
                  'font-size': '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRespawn}
                disabled={respawning()}
                style={{
                  padding: '7px 14px',
                  'border-radius': '4px',
                  border: '1px solid #da3633',
                  background: '#da3633',
                  color: '#fff',
                  cursor: respawning() ? 'default' : 'pointer',
                  opacity: respawning() ? 0.6 : 1,
                  'font-size': '13px',
                  'font-weight': 600,
                }}
              >
                {respawning() ? 'Respawning…' : 'Respawn'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showPasswordDialog()}>
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.65)',
            'z-index': 200,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !changingPassword()) setShowPasswordDialog(false)
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitPasswordChange()
            }}
            style={{
              width: 'min(420px, calc(100% - 48px))',
              background: '#161b22',
              border: '1px solid #30363d',
              'border-radius': '8px',
              'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
              padding: '20px',
            }}
          >
            <div style={{ 'font-size': '16px', 'font-weight': 600, color: '#c9d1d9', 'margin-bottom': '16px' }}>
              {hasPassword() ? 'Change password' : 'Set password'}
            </div>
            <Show when={hasPassword()}>
              <PasswordField label="Current password" value={oldPassword()} onInput={setOldPassword} autofocus />
            </Show>
            <PasswordField label="New password" value={newPassword()} onInput={setNewPassword} autofocus={!hasPassword()} />
            <PasswordField label="Confirm new password" value={confirmPassword()} onInput={setConfirmPassword} />
            <Show when={passwordError() && (newPassword() || confirmPassword())}>
              <div style={{ 'font-size': '12px', color: '#f85149', 'margin-bottom': '12px' }}>{passwordError()}</div>
            </Show>
            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
              <button
                type="button"
                onClick={() => setShowPasswordDialog(false)}
                disabled={changingPassword()}
                style={{
                  padding: '7px 14px',
                  'border-radius': '4px',
                  border: '1px solid #30363d',
                  background: '#21262d',
                  color: '#c9d1d9',
                  cursor: changingPassword() ? 'default' : 'pointer',
                  'font-size': '13px',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changingPassword() || passwordError() != null}
                style={{
                  padding: '7px 14px',
                  'border-radius': '4px',
                  border: '1px solid #238636',
                  background: '#238636',
                  color: '#fff',
                  cursor: changingPassword() || passwordError() != null ? 'default' : 'pointer',
                  opacity: changingPassword() || passwordError() != null ? 0.6 : 1,
                  'font-size': '13px',
                  'font-weight': 600,
                }}
              >
                {changingPassword() ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  )
}

function PasswordField(props: { label: string; value: string; onInput: (v: string) => void; autofocus?: boolean }) {
  return (
    <label style={{ display: 'block', 'margin-bottom': '12px' }}>
      <span style={{ display: 'block', 'font-size': '12px', color: '#8b949e', 'margin-bottom': '4px' }}>{props.label}</span>
      <input
        type="password"
        autofocus={props.autofocus}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        style={{
          width: '100%',
          padding: '7px 10px',
          'border-radius': '4px',
          border: '1px solid #30363d',
          background: '#0d1117',
          color: '#c9d1d9',
          'font-size': '13px',
        }}
      />
    </label>
  )
}

function MenuItem(props: { onClick: () => void; danger?: boolean; children: JSX.Element }) {
  const [hover, setHover] = createSignal(false)
  return (
    <button
      onClick={() => props.onClick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        'align-items': 'center',
        gap: '8px',
        padding: '8px 10px',
        'border-radius': '4px',
        border: 'none',
        background: hover() ? '#21262d' : 'transparent',
        color: props.danger ? '#f85149' : '#c9d1d9',
        cursor: 'pointer',
        'font-size': '13px',
        'text-align': 'left',
      }}
    >
      {props.children}
    </button>
  )
}
