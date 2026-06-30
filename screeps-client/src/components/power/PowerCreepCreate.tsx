import { createSignal, Show, For } from 'solid-js'
import { ChevronLeft } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { goToUserPower, goToUserPowerCreep } from '~/stores/routeStore.js'
import { addToast } from '~/stores/toastStore.js'
import { POWER_CLASS_INFO, POWER_CREEP_CLASSES, powersForClass, type PowerCreepClass } from '~/data/powerCreeps.js'
import type { PowerContext, PowerNav } from './PowerCreeps.js'
import { PowerClassIcon } from './PowerClassIcon.js'
import { PowerTile } from './PowerTile.js'
import { PANEL, PANEL_RAISED, BORDER, TEXT, MUTED, ACCENT, GREEN, GPL_TEXT } from './theme.js'

export function PowerCreepCreate(props: { ctx: PowerContext; nav?: PowerNav }) {
  const [name, setName] = createSignal('')
  const [selected, setSelected] = createSignal<PowerCreepClass>('operator')
  const [saving, setSaving] = createSignal(false)

  const info = () => POWER_CLASS_INFO[selected()]
  const canCreate = () =>
    !saving() && props.ctx.free() >= 1 && name().trim().length > 0 && !info().underDevelopment

  const backToList = () => (props.nav?.goToList ?? goToUserPower)()

  const handleCreate = async () => {
    const c = client()
    if (!c || !canCreate()) return
    const creepName = name().trim()
    setSaving(true)
    try {
      await c.http.game.powerCreeps.create(creepName, selected())
      await props.ctx.reload()
      // Jump straight into the new creep's editor to assign powers.
      const created = props.ctx.creeps().find((cr) => cr.name === creepName)
      addToast(`Power creep "${creepName}" created`, 'success', 3000)
      if (created) (props.nav?.goToCreep ?? goToUserPowerCreep)(created._id)
      else backToList()
    } catch (err) {
      addToast(`Failed to create power creep: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '20px' }}>
        <button
          onClick={backToList}
          style={{ display: 'inline-flex', 'align-items': 'center', gap: '4px', padding: '6px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, 'font-size': '13px', cursor: 'pointer' }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <span style={{ color: MUTED, 'font-size': '13px' }}>Creating a power creep uses <strong style={{ color: GPL_TEXT }}>1</strong> free Power Level</span>
      </div>

      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '10px', padding: '24px' }}>
        {/* Name */}
        <label style={{ display: 'block', color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'font-weight': 700, 'margin-bottom': '8px' }}>Creep name</label>
        <input
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Enter creep name"
          maxLength={50}
          style={{ width: '100%', 'box-sizing': 'border-box', padding: '9px 12px', 'border-radius': '6px', border: `1px solid ${BORDER}`, background: '#0d1117', color: TEXT, 'font-size': '14px', outline: 'none', 'margin-bottom': '24px' }}
        />

        {/* Class select */}
        <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'font-weight': 700, 'margin-bottom': '10px' }}>Select class</div>
        <div style={{ display: 'flex', gap: '12px', 'margin-bottom': '14px' }}>
          <For each={POWER_CREEP_CLASSES}>
            {(cls) => {
              const cInfo = POWER_CLASS_INFO[cls]
              const active = () => selected() === cls
              return (
                <button
                  onClick={() => setSelected(cls)}
                  style={{
                    flex: 1, display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '8px', padding: '16px 8px',
                    'border-radius': '8px', cursor: 'pointer',
                    border: `1px solid ${active() ? ACCENT : BORDER}`,
                    background: active() ? '#1c2d47' : PANEL_RAISED,
                    color: active() ? TEXT : MUTED,
                  }}
                >
                  <PowerClassIcon class={cls} size={36} color={active() ? GPL_TEXT : MUTED} />
                  <span style={{ 'font-size': '13px', 'font-weight': 600 }}>{cInfo.label}</span>
                  <Show when={cInfo.underDevelopment}>
                    <span style={{ 'font-size': '10px', color: '#f0883e' }}>Under development</span>
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
        <p style={{ color: MUTED, 'font-size': '13px', 'line-height': '1.5', margin: '0 0 24px' }}>
          {info().description}
          <Show when={info().underDevelopment}><span style={{ color: '#f0883e' }}> (Under development)</span></Show>
        </p>

        {/* Powers preview */}
        <Show
          when={!info().underDevelopment}
          fallback={<div style={{ color: MUTED, 'font-size': '13px', 'text-align': 'center', padding: '24px 0' }}>This class has no powers available yet.</div>}
        >
          <div style={{ color: MUTED, 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'font-weight': 700, 'margin-bottom': '12px' }}>{info().label} powers</div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <For each={powersForClass(selected())}>
              {(def) => <PowerTile def={def} currentLevel={0} />}
            </For>
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-top': '16px' }}>
        <button
          onClick={handleCreate}
          disabled={!canCreate()}
          title={props.ctx.free() < 1 ? 'You need 1 free Power Level' : undefined}
          style={{
            padding: '9px 20px', 'border-radius': '6px', border: 'none',
            background: canCreate() ? GREEN : '#21262d', color: canCreate() ? '#fff' : MUTED,
            'font-size': '14px', 'font-weight': 600, cursor: canCreate() ? 'pointer' : 'not-allowed', opacity: canCreate() ? 1 : 0.7,
          }}
        >
          {saving() ? 'Creating…' : 'Create creep'}
        </button>
      </div>
    </div>
  )
}
