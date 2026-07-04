import { isTauri } from '~/utils/tauri.js'
import { isEmbedded, isXxscreepsMode } from '~/utils/embedded.js'
import { isPrivateServer } from './clientStore.js'

export interface Capabilities {
  isDesktop: boolean
  isEmbedded: boolean
  isXxscreepsMode: boolean
  isPrivateServer: boolean | null
  // Placeholders: no server-side signal exists yet for these. Flip to real
  // detection here (a feature flag, a probe, whatever) without touching callers.
  hasMarket: boolean
  hasMessaging: boolean
}

export function capabilities(): Capabilities {
  return {
    isDesktop: isTauri(),
    isEmbedded: isEmbedded(),
    isXxscreepsMode: isXxscreepsMode(),
    isPrivateServer: isPrivateServer(),
    hasMarket: true,
    hasMessaging: true,
  }
}
