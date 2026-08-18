import { createEffect, createRoot } from 'solid-js'
import { client, serverVersion } from './clientStore.js'
import { setCustomRendererConfig } from '~/renderer/custom/registry.js'
import { createLogger } from '~/utils/log.js'

const { log } = createLogger('custom-renderer')

/**
 * Feeds mod-defined render metadata from `/api/version` into the room renderer's
 * registry.
 *
 * Wrapped in createRoot so the module-level effect has a reactive owner. Both
 * inputs matter: the config itself, and the connection it belongs to — the base
 * URL resolves the `{ASSETS_URL}` placeholder in texture URLs, and switching
 * servers has to drop the previous server's metadata rather than leave it
 * standing.
 */
createRoot(() => {
  createEffect(() => {
    const c = client()
    const config = serverVersion()?.serverData?.renderer
    if (!c) {
      setCustomRendererConfig(undefined, 'http://localhost/')
      return
    }
    setCustomRendererConfig(config, c.http.baseUrl)
    const types = Object.keys(config?.metadata ?? {})
    if (types.length > 0) log('server defines render metadata for', types.join(', '))
  })
})

export {}
