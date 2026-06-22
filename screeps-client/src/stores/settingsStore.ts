import { createSignal } from 'solid-js'
import { LS } from '~/utils/storage.js'

function boolSetting(key: string, defaultVal: boolean): [() => boolean, (v: boolean) => void] {
  const stored = localStorage.getItem(key)
  const [val, setVal] = createSignal(stored !== null ? stored === 'true' : defaultVal)
  return [val, (v: boolean) => { setVal(v); localStorage.setItem(key, String(v)) }]
}

function strSetting(key: string, defaultVal: string): [() => string, (v: string) => void] {
  const stored = localStorage.getItem(key)
  const [val, setVal] = createSignal(stored ?? defaultVal)
  return [val, (v: string) => { setVal(v); localStorage.setItem(key, v) }]
}

export const [widescreenMode, setWidescreenMode] = boolSetting(LS.widescreenMode, true)
export const [showCreepLabels, setShowCreepLabels] = boolSetting(LS.showCreepLabels, true)
export const [showMapRoomNames, setShowMapRoomNames] = boolSetting(LS.showMapRoomNames, false)
export const [showUnclaimableRooms, setShowUnclaimableRooms] = boolSetting(LS.showUnclaimableRooms, true)
export const [terrainEffects, setTerrainEffects] = boolSetting(LS.terrainEffects, true)
export const [showRoomDecorations, setShowRoomDecorations] = boolSetting(LS.showRoomDecorations, false)
export const [roomDarkOverlay, setRoomDarkOverlay] = boolSetting(LS.roomDarkOverlay, true)
export const [showRoomVisuals, setShowRoomVisuals] = boolSetting(LS.showRoomVisuals, true)
export const [spriteTheme, setSpriteTheme] = strSetting(LS.spriteTheme, 'default')
export const [showMapVisuals, setShowMapVisuals] = boolSetting(LS.showMapVisuals, true)
