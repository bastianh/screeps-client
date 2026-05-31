import { JSX, createSignal, Show, createMemo } from 'solid-js'
import { X } from 'lucide-solid'
import {
  widescreenMode, setWidescreenMode,
  showCreepLabels, setShowCreepLabels,
  showMapRoomNames, setShowMapRoomNames,
  showUnclaimableRooms, setShowUnclaimableRooms,
  terrainEffects, setTerrainEffects,
  showRoomDecorations, setShowRoomDecorations,
  roomDarkOverlay, setRoomDarkOverlay,
  spriteTheme, setSpriteTheme,
  verboseCreepDetails, setVerboseCreepDetails,
} from '~/stores/settingsStore.js'
import { clientVersion, embeddedModInfo } from '~/utils/embedded.js'
import { userInfo, isGuest } from '~/stores/clientStore.js'
import { badgeToSvg } from 'screeps-connectivity'
import type { Badge } from 'screeps-connectivity'
import { BadgePickerModal } from '~/components/BadgePickerModal.js'
import { clearAllCaches } from '~/utils/storage.js'
import { addToast } from '~/stores/toastStore.js'

const DEFAULT_BADGE: Badge = { type: 1, color1: '#4a5060', color2: '#7a9ec0', color3: '#c0daf0', param: 0, flip: false }

interface ToggleProps {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}

function Toggle(props: ToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '10px 0',
        'border-bottom': '1px solid #21262d',
      }}
    >
      <div>
        <div style={{ 'font-size': '13px', color: '#c9d1d9' }}>{props.label}</div>
        {props.description && (
          <div style={{ 'font-size': '11px', color: '#8b949e', 'margin-top': '3px' }}>
            {props.description}
          </div>
        )}
      </div>
      <button
        onClick={() => props.onChange(!props.value)}
        style={{
          'flex-shrink': 0,
          'margin-left': '24px',
          width: '40px',
          height: '20px',
          'border-radius': '10px',
          border: 'none',
          background: props.value ? '#238636' : '#30363d',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: props.value ? '22px' : '2px',
            width: '16px',
            height: '16px',
            'border-radius': '50%',
            background: '#fff',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <div style={{ 'margin-bottom': '24px' }}>
      <div
        style={{
          'font-size': '10px',
          'font-weight': 700,
          color: '#8b949e',
          'text-transform': 'uppercase',
          'letter-spacing': '0.06em',
          'margin-bottom': '4px',
        }}
      >
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '24px',
        padding: '10px 0',
        'border-bottom': '1px solid #21262d',
      }}
    >
      <div style={{ 'font-size': '13px', color: '#c9d1d9' }}>{props.label}</div>
      <div style={{ 'font-size': '12px', color: '#8b949e', 'text-align': 'right' }}>{props.value}</div>
    </div>
  )
}

export function SettingsPanel(props: { onClose: () => void }) {
  const modInfo = embeddedModInfo()
  const openedForBadgeCreation = !isGuest() && !userInfo()?.badge
  const [showBadgePicker, setShowBadgePicker] = createSignal(openedForBadgeCreation)
  const [clearing, setClearing] = createSignal(false)

  const badgePreviewSrc = createMemo(() => {
    const badge = userInfo()?.badge
    if (!badge) return null
    const svg = badgeToSvg(badge)
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  })

  async function handleClearCaches() {
    setClearing(true)
    try {
      await clearAllCaches()
      addToast('All caches cleared. Reloading…', 'success', 2000)
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      addToast('Failed to clear caches.', 'error')
      setClearing(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: '0px',
        background: 'rgba(13, 17, 23, 0.96)',
        'z-index': 100,
        display: 'flex',
        'flex-direction': 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '14px 24px',
          'border-bottom': '1px solid #30363d',
          'flex-shrink': 0,
        }}
      >
        <span style={{ 'font-size': '15px', 'font-weight': 600, color: '#c9d1d9' }}>Settings</span>
        <button
          onClick={() => props.onClose()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            'line-height': '1',
            padding: '2px 6px',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Badge picker modal */}
      <Show when={showBadgePicker()}>
        <BadgePickerModal
          badge={userInfo()?.badge ?? DEFAULT_BADGE}
          onClose={() => setShowBadgePicker(false)}
          onSaved={openedForBadgeCreation ? () => props.onClose() : undefined}
        />
      </Show>

      {/* Body */}
      <div style={{ overflow: 'auto', flex: 1, padding: '20px 24px' }}>
        <div style={{ 'max-width': '480px' }}>

          <Section title="Layout">
            <Toggle
              label="Widescreen mode"
              description="Sidebar spans full height; console sits below the room view only. When off, the console spans the full width below both the view and the sidebar."
              value={widescreenMode()}
              onChange={setWidescreenMode}
            />
          </Section>

          <Section title="Room View">
            <Toggle
              label="Show creep labels"
              description="Display each creep's name above its sprite."
              value={showCreepLabels()}
              onChange={setShowCreepLabels}
            />
            <Toggle
              label="Terrain effects"
              description="Swamp glow and wall noise texture overlay."
              value={terrainEffects()}
              onChange={setTerrainEffects}
            />
            <Toggle
              label="Verbose creep details"
              description="Show a colour-coded body part breakdown (e.g. 8×MOVE, 4×WORK) in the creep property panel."
              value={verboseCreepDetails()}
              onChange={setVerboseCreepDetails}
            />
            <Toggle
              label="Room decorations"
              description="Load player-activated theme decorations (floor, wall, road colors) from the server."
              value={showRoomDecorations()}
              onChange={setShowRoomDecorations}
            />
            <Toggle
              label="Dark overlay + lights"
              description="Darken the room and add per-object light glows."
              value={roomDarkOverlay()}
              onChange={setRoomDarkOverlay}
            />
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
              <label style={{ 'font-size': '13px', 'font-weight': '500' }}>Structure theme</label>
              <select
                value={spriteTheme()}
                onChange={e => setSpriteTheme(e.currentTarget.value)}
                style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #444', 'border-radius': '4px', padding: '4px 8px', 'font-size': '13px' }}
              >
                <option value="vector">Vector (procedural)</option>
                <option value="default">Default (sprites)</option>
              </select>
            </div>
          </Section>

          <Section title="Map View">
            <Toggle
              label="Show room names"
              description="Render a small room name in the top-left corner of each map tile."
              value={showMapRoomNames()}
              onChange={setShowMapRoomNames}
            />
            <Toggle
              label="Show unclaimable rooms"
              description="Highlight rooms where you cannot claim a controller: corridors, sector centres, rooms already owned, and restricted areas."
              value={showUnclaimableRooms()}
              onChange={setShowUnclaimableRooms}
            />
          </Section>

          <Show when={!isGuest()}>
            <Section title="Player Badge">
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '10px 0',
                  'border-bottom': '1px solid #21262d',
                }}
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
                  <Show when={badgePreviewSrc()}>
                    <img src={badgePreviewSrc()!} width={40} height={40} style={{ display: 'block' }} />
                  </Show>
                  <span style={{ 'font-size': '13px', color: '#c9d1d9' }}>{userInfo()?.username ?? ''}</span>
                </div>
                <button
                  onClick={() => setShowBadgePicker(true)}
                  style={{
                    padding: '6px 14px',
                    'border-radius': '6px',
                    border: '1px solid #30363d',
                    background: 'transparent',
                    color: '#c9d1d9',
                    'font-size': '12px',
                    cursor: 'pointer',
                    'flex-shrink': 0,
                  }}
                >
                  {badgePreviewSrc() ? 'Edit Badge' : 'Create Badge'}
                </button>
              </div>
            </Section>
          </Show>

          <Section title="Data">
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                padding: '10px 0',
                'border-bottom': '1px solid #21262d',
              }}
            >
              <div>
                <div style={{ 'font-size': '13px', color: '#c9d1d9' }}>Clear all caches</div>
                <div style={{ 'font-size': '11px', color: '#8b949e', 'margin-top': '3px' }}>
                  Deletes IndexedDB, Cache API, and localStorage. Session is kept. Page reloads afterwards.
                </div>
              </div>
              <button
                disabled={clearing()}
                onClick={handleClearCaches}
                style={{
                  'flex-shrink': 0,
                  'margin-left': '24px',
                  padding: '6px 14px',
                  'border-radius': '6px',
                  border: '1px solid #da3633',
                  background: 'transparent',
                  color: clearing() ? '#8b949e' : '#f85149',
                  'font-size': '12px',
                  cursor: clearing() ? 'default' : 'pointer',
                  opacity: clearing() ? 0.6 : 1,
                }}
              >
                {clearing() ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          </Section>

          <Section title="About">
            <InfoRow label="Client version" value={clientVersion()} />
            {modInfo && (
              <InfoRow
                label="Mod version"
                value={`${modInfo.version} (${modInfo.kind})`}
              />
            )}
          </Section>

        </div>
      </div>
    </div>
  )
}
