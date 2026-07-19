import { createSignal, createEffect, onCleanup } from 'solid-js'
import { fetchServerVersion, fetchAuthModInfo, getScreepsmodAuth } from 'screeps-connectivity'
import type { ServerVersion, ApiAuthModInfoResponse } from 'screeps-connectivity'
import { isProxy, toProxyUrl } from './proxy.js'
import { embeddedServerVersion } from './embedded.js'

/**
 * Probes a candidate server URL (before login) for its version/feature info,
 * debounced so it doesn't fire on every keystroke while the user is still
 * typing a server URL.
 */
export function useServerInfo(url: () => string) {
  const [serverVersion, setServerVersion] = createSignal<ServerVersion | null>(null)
  const [authModInfo, setAuthModInfo] = createSignal<ApiAuthModInfoResponse | null>(null)
  const [serverError, setServerError] = createSignal<string | null>(null)

  // When embedded, the host mod inlines the `/api/version` payload into the page,
  // so the login UI is configured from the first frame with no version fetch. We
  // only reach out for screepsmod-auth menu/auth-type details if the inlined
  // version advertises that mod (classic private servers) — xxscreeps doesn't run
  // it, so that path stays at zero round-trips.
  const inlined = embeddedServerVersion()
  if (inlined) {
    setServerVersion(inlined)
    if (getScreepsmodAuth(inlined)) {
      const probeUrl = isProxy() ? toProxyUrl(url()) : url()
      let cancelled = false
      void fetchAuthModInfo(probeUrl).then(mod => { if (!cancelled) setAuthModInfo(mod) }).catch(() => {})
      onCleanup(() => { cancelled = true })
    }
    return { serverVersion, authModInfo, serverError }
  }

  createEffect(() => {
    const rawUrl = url()
    // In proxy mode the pre-login capability probes must go through the proxy too.
    const probeUrl = isProxy() ? toProxyUrl(rawUrl) : rawUrl
    setServerVersion(null)
    setAuthModInfo(null)
    setServerError(null)

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const v = await fetchServerVersion(probeUrl)
        if (cancelled) return
        setServerVersion(v)
        setServerError(null)
        if (getScreepsmodAuth(v)) {
          const mod = await fetchAuthModInfo(probeUrl)
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
