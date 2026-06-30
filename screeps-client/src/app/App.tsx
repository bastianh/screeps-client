import { createSignal, onMount } from 'solid-js'
import { client, status, tryAutoConnect, connect } from '~/stores/clientStore.js'
import { LoginForm } from '~/components/LoginForm.js'
import { DesktopLoginForm } from '~/components/DesktopLoginForm.js'
import { ConnectingScreen } from '~/components/ConnectingScreen.js'
import { Dashboard } from './Dashboard.js'

import { isEmbedded, isXxscreepsMode, embeddedServerUrl } from '~/utils/embedded.js'
import { isTauri } from '~/utils/tauri.js'
import { createLogger } from '~/utils/log.js'
import { SS, getSession } from '~/utils/storage.js'

const { log } = createLogger('app')

function guestAutoConnectUrl(): string | null {
  const param = new URLSearchParams(window.location.search).get('guest')
  if (param === null) return null
  if (param.startsWith('http')) return param
  return getSession(SS.url) ?? 'https://screeps.com'
}

// Whether a connection will be attempted automatically on boot — known
// synchronously at first render, so we can show the ConnectingScreen instead of
// flashing the LoginForm. Mirrors the conditions handled in onMount and
// tryAutoConnect.
function willAutoConnect(): boolean {
  if (isXxscreepsMode()) return true
  if (guestAutoConnectUrl() !== null) return true
  const url = isEmbedded() ? embeddedServerUrl() : getSession(SS.url)
  // In Tauri the token lives in the OS keychain (async) — if a URL is stored,
  // optimistically show the boot screen and let tryAutoConnect() decide.
  if (isTauri()) return Boolean(url)
  const token = getSession(SS.token)
  return Boolean(url && token)
}

export function App() {
  const isConnected = () => status() === 'connected' && client() !== null
  const isDesktop = isTauri()
  // True until the initial auto-connect attempt settles, so the boot splash is
  // only shown during startup and never re-appears (e.g. after a later logout).
  const [booting, setBooting] = createSignal(willAutoConnect())

  onMount(async () => {
    try {
      if (status() === 'idle') {
        await tryAutoConnect().catch(() => {})
        if (status() !== 'connected') {
          if (isXxscreepsMode()) {
            const url = embeddedServerUrl()
            log(`xxscreeps mode — auto-connecting as guest to ${url}`)
            await connect({ url, auth: 'guest', storage: null }).catch(() => {})
          } else if (!isEmbedded()) {
            const guestUrl = guestAutoConnectUrl()
            if (guestUrl) {
              log(`?guest param — auto-connecting as guest to ${guestUrl}`)
              await connect({ url: guestUrl, auth: 'guest', storage: null }).catch(() => {})
            }
          }
        }
      }
    } finally {
      setBooting(false)
    }
  })

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {isConnected()
        ? <Dashboard />
        : booting()
          ? <ConnectingScreen />
          : isDesktop ? <DesktopLoginForm /> : <LoginForm />}
    </div>
  )
}
