import { JSX } from 'solid-js'
import {
  widescreenMode, setWidescreenMode,
  showCreepLabels, setShowCreepLabels,
  showMapRoomNames, setShowMapRoomNames,
  showUnclaimableRooms, setShowUnclaimableRooms,
} from '~/stores/settingsStore.js'
import { clientVersion, embeddedModInfo } from '~/utils/embedded.js'

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
            'font-size': '18px',
            cursor: 'pointer',
            'line-height': '1',
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

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
