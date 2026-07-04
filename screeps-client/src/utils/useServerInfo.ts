import { createSignal, createEffect, onCleanup } from 'solid-js'
import { fetchServerVersion, fetchAuthModInfo, getScreepsmodAuth } from 'screeps-connectivity'
import type { ServerVersion, ApiAuthModInfoResponse } from 'screeps-connectivity'

/**
 * Probes a candidate server URL (before login) for its version/feature info,
 * debounced so it doesn't fire on every keystroke while the user is still
 * typing a server URL.
 */
export function useServerInfo(url: () => string) {
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
