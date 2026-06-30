import { JSX, createSignal, Show, For } from 'solid-js'
import { X } from 'lucide-solid'
import { OverlayPage } from '~/components/OverlayPage.js'
import {
  widescreenMode, setWidescreenMode,
  terrainEffects, setTerrainEffects,
  showRoomDecorations, setShowRoomDecorations,
  roomDarkOverlay, setRoomDarkOverlay,
  spriteTheme, setSpriteTheme,
} from '~/stores/settingsStore.js'
import { clientVersion, embeddedModInfo } from '~/utils/embedded.js'
import { userInfo, isGuest, client } from '~/stores/clientStore.js'
import type { NotifyPrefs } from 'screeps-connectivity'
import { clearAllCaches } from '~/utils/storage.js'
import { addToast } from '~/stores/toastStore.js'

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

function SelectRow(props: { label: string; description?: string; value: number | string; options: { value: number | string; label: string }[]; onChange: (v: number) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '10px 0',
        'border-bottom': '1px solid #21262d',
        gap: '24px',
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
      <select
        value={String(props.value)}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
        style={{
          'flex-shrink': 0,
          background: '#21262d',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          'border-radius': '4px',
          padding: '4px 8px',
          'font-size': '12px',
          cursor: 'pointer',
        }}
      >
        <For each={props.options}>
          {(o) => <option value={String(o.value)}>{o.label}</option>}
        </For>
      </select>
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

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
  { value: 4320, label: '3 days' },
]

const ERRORS_INTERVAL_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 10, label: 'Every 10 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every 1 hour' },
  { value: 180, label: 'Every 3 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' },
  { value: 4320, label: 'Every 3 days' },
  { value: 100000, label: 'Never' },
]

export function SettingsPanel(props: { onClose: () => void }) {
  const modInfo = embeddedModInfo()
  const [clearing, setClearing] = createSignal(false)

  async function saveNotifyPref(pref: Partial<NotifyPrefs>) {
    const c = client()
    if (!c) return
    try {
      await c.http.user.notifyPrefs(pref)
      await c.stores.user.refreshMe()
    } catch (err) {
      addToast(`Failed to save notification preference: ${(err as Error).message}`, 'error')
    }
  }

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
    <OverlayPage maxWidth="600px">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          padding: '0 0 14px',
          'border-bottom': '1px solid #30363d',
          'margin-bottom': '24px',
        }}
      >
        <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: '#c9d1d9' }}>Settings</h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => props.onClose()}
          title="Close"
          style={{ display: 'flex', 'align-items': 'center', padding: '7px', 'border-radius': '4px', border: '1px solid #30363d', background: '#21262d', color: '#c9d1d9', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

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
              label="Terrain effects"
              description="Swamp glow and wall noise texture overlay."
              value={terrainEffects()}
              onChange={setTerrainEffects}
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

          <Show when={!isGuest()}>
            <Section title="Notifications">
              {(() => {
                const prefs = () => userInfo()?.notifyPrefs ?? {}
                const enabled = () => !prefs().disabled
                return (
                  <>
                    <Toggle
                      label="Email notifications"
                      description="Send email notifications for game events."
                      value={enabled()}
                      onChange={(v) => void saveNotifyPref({ disabled: !v })}
                    />
                    <Show when={enabled()}>
                      <SelectRow
                        label="Send interval"
                        description="Notifications are grouped and mailed out at this interval."
                        value={prefs().interval ?? 60}
                        options={INTERVAL_OPTIONS}
                        onChange={(v) => void saveNotifyPref({ interval: v })}
                      />
                      <Toggle
                        label="Send when online"
                        description="Send notifications even while you are active in the game."
                        value={prefs().sendOnline ?? false}
                        onChange={(v) => void saveNotifyPref({ sendOnline: v })}
                      />
                      <SelectRow
                        label="Notify on errors"
                        description="Send a notification when your script throws an error."
                        value={prefs().errorsInterval ?? 30}
                        options={ERRORS_INTERVAL_OPTIONS}
                        onChange={(v) => void saveNotifyPref({ errorsInterval: v })}
                      />
                      <Toggle
                        label="Notify on new messages"
                        description="Send a notification when you receive a new in-game message."
                        value={!(prefs().disabledOnMessages ?? false)}
                        onChange={(v) => void saveNotifyPref({ disabledOnMessages: !v })}
                      />
                    </Show>
                  </>
                )
              })()}
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
    </OverlayPage>
  )
}
