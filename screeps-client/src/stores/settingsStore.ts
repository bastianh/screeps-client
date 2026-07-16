import { createSignal } from 'solid-js'
import { LS } from '~/utils/storage.js'

function boolSetting(key: string, defaultVal: boolean): [() => boolean, (v: boolean) => void] {
  const stored = localStorage.getItem(key)
  const [val, setVal] = createSignal(stored !== null ? stored === 'true' : defaultVal)
  return [val, (v: boolean) => { setVal(v); localStorage.setItem(key, String(v)) }]
}

export const [widescreenMode, setWidescreenMode] = boolSetting(LS.widescreenMode, true)
export const [showCreepLabels, setShowCreepLabels] = boolSetting(LS.showCreepLabels, true)
export const [showMapRoomNames, setShowMapRoomNames] = boolSetting(LS.showMapRoomNames, false)
export const [showUnclaimableRooms, setShowUnclaimableRooms] = boolSetting(LS.showUnclaimableRooms, true)
export const [terrainEffects, setTerrainEffects] = boolSetting(LS.terrainEffects, true)
export const [showRoomDecorations, setShowRoomDecorations] = boolSetting(LS.showRoomDecorations, false)
export const [roomDarkOverlay, setRoomDarkOverlay] = boolSetting(LS.roomDarkOverlay, true)
export const [showRoomVisuals, setShowRoomVisuals] = boolSetting(LS.showRoomVisuals, true)
// When off, tick-driven animations (creep movement, fill tweens, build glows, cooldown
// pulses) snap instantly instead of interpolating between ticks. Wall-clock ambient
// pulses (source glow, tower sweep, keeper-lair glow) are unaffected.
export const [smoothAnimations, setSmoothAnimations] = boolSetting(LS.smoothAnimations, true)
export const [showMapVisuals, setShowMapVisuals] = boolSetting(LS.showMapVisuals, true)
export const [hideCustomUiProtocol, setHideCustomUiProtocol] = boolSetting(LS.hideCustomUiProtocol, true)
