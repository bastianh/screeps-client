import { getServerFeature } from 'screeps-connectivity'
import { isTauri } from '~/utils/tauri.js'
import { isProxy } from '~/utils/proxy.js'
import { isEmbedded, isXxscreepsMode } from '~/utils/embedded.js'
import { isPrivateServer, serverVersion } from './clientStore.js'

export interface Capabilities {
  isDesktop: boolean
  // Served by screeps-client-proxy (browser, /api+/socket proxied via /(backend)/).
  isProxy: boolean
  isEmbedded: boolean
  isXxscreepsMode: boolean
  isPrivateServer: boolean | null
  // Room history playback. Gated on the server advertising a history chunk
  // size in /api/version — servers that don't store tick history omit it.
  hasHistory: boolean
  // Placeholders: no server-side signal exists yet for these. Flip to real
  // detection here (a feature flag, a probe, whatever) without touching callers.
  hasMarket: boolean
  hasMessaging: boolean
  // Decoration inventory. The reference client gates its /inventory route on this
  // exact feature flag out of /api/version, so private servers without decorations
  // simply don't advertise it and the section stays hidden.
  hasInventory: boolean
}

export function capabilities(): Capabilities {
  return {
    isDesktop: isTauri(),
    isProxy: isProxy(),
    isEmbedded: isEmbedded(),
    isXxscreepsMode: isXxscreepsMode(),
    isPrivateServer: isPrivateServer(),
    hasHistory: (serverVersion()?.serverData?.historyChunkSize ?? 0) > 0,
    hasMarket: true,
    hasMessaging: true,
    hasInventory: hasInventoryFeature(),
  }
}

function hasInventoryFeature(): boolean {
  const version = serverVersion()
  return version != null && getServerFeature(version, 'inventory') != null
}
