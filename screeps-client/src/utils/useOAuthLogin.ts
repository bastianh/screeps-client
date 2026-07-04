import { createSignal, onCleanup } from 'solid-js'
import { fetchAuthMeWithToken, completeProviderRegistration } from 'screeps-connectivity'

export interface OAuthPendingRegistration {
  url: string
  token: string
}

/**
 * Drives an OAuth popup login flow (`/api/auth/<provider>`) for any provider a
 * screepsmod-auth/xxscreeps server supports — Steam, Discord, GitHub, GitLab, etc.
 * Some servers hand back a provisional token for a brand-new signup that has no
 * username yet — that token can't authenticate anything (including the websocket)
 * until a username is chosen via `/api/register/set-username`. This checks
 * `/api/auth/me` right after the popup closes to tell the two cases apart, so the
 * caller never tries to connect with a token that's guaranteed to fail auth.
 */
export function useOAuthLogin(provider: string, onAuthenticated: (result: { url: string; token: string }) => void) {
  const [pending, setPending] = createSignal<OAuthPendingRegistration | null>(null)
  const [submitting, setSubmitting] = createSignal(false)
  const [regError, setRegError] = createSignal<string | null>(null)

  const handleToken = async (url: string, token: string) => {
    try {
      const me = await fetchAuthMeWithToken(url, token)
      if (me?.username) {
        onAuthenticated({ url, token })
      } else {
        setRegError(null)
        setPending({ url, token })
      }
    } catch {
      // Couldn't check registration status — try the token as-is rather than blocking login.
      onAuthenticated({ url, token })
    }
  }

  const startLogin = (rawUrl: string) => {
    const url = rawUrl.replace(/\/$/, '')
    const popup = window.open(`${url}/api/auth/${provider}`, `screeps-oauth-${provider}`, 'width=800,height=600,left=200,top=100')
    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { token?: string }
        if (data.token) { cleanup(); void handleToken(url, data.token) }
      } catch { /* non-JSON */ }
    }
    const checkClosed = setInterval(() => { if (popup?.closed) cleanup() }, 500)
    const cleanup = () => { clearInterval(checkClosed); window.removeEventListener('message', onMessage) }
    window.addEventListener('message', onMessage)
    onCleanup(cleanup)
  }

  const completeRegistration = async (username: string, email?: string) => {
    const p = pending()
    if (!p) return
    setSubmitting(true)
    setRegError(null)
    try {
      const { token } = await completeProviderRegistration(p.url, p.token, username, email)
      setPending(null)
      onAuthenticated({ url: p.url, token })
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelRegistration = () => { setPending(null); setRegError(null) }

  return { startLogin, pending, submitting, regError, completeRegistration, cancelRegistration }
}
