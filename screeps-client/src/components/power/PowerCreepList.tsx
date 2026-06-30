import { Show, For } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Plus } from 'lucide-solid'
import type { ApiPowerCreep } from 'screeps-connectivity'
import { goToUserPowerNew, goToUserPowerCreep } from '~/stores/routeStore.js'
import { POWER_CLASS_INFO, POWER_DEFS_BY_ID, POWER_CREEP_CLASSES, type PowerCreepClass } from '~/data/powerCreeps.js'
import type { PowerContext, PowerNav } from './PowerCreeps.js'
import { PowerClassIcon } from './PowerClassIcon.js'
import { PANEL, PANEL_RAISED, BORDER, TEXT, MUTED, GREEN, POWER_RED, GPL_TEXT } from './theme.js'

const POWER_DOCS = 'https://docs.screeps.com/power.html'

function CreateButton(props: { free: number; onNew: () => void }) {
  const enabled = () => props.free >= 1
  return (
    <button
      onClick={() => enabled() && props.onNew()}
      disabled={!enabled()}
      title={enabled() ? 'Create a new power creep' : 'You need 1 free Power Level to create a power creep'}
      style={{
        display: 'inline-flex', 'align-items': 'center', gap: '6px', padding: '8px 16px', 'border-radius': '6px',
        border: 'none', background: enabled() ? GREEN : '#21262d', color: enabled() ? '#fff' : MUTED,
        'font-size': '13px', 'font-weight': 600, cursor: enabled() ? 'pointer' : 'not-allowed', opacity: enabled() ? 1 : 0.7,
      }}
    >
      <Plus size={16} /> Create creep
    </button>
  )
}

function CreepCard(props: { creep: ApiPowerCreep; onSelect: (id: string) => void }) {
  const className = () => props.creep.className as PowerCreepClass
  const info = () => POWER_CLASS_INFO[className()] ?? POWER_CLASS_INFO.operator
  const assigned = () => {
    const map = props.creep.powers ?? {}
    return Object.keys(map)
      .filter((id) => (map[id]?.level ?? 0) > 0)
      .map((id) => POWER_DEFS_BY_ID[Number(id)])
      .filter(Boolean)
  }

  return (
    <button
      onClick={() => props.onSelect(props.creep._id)}
      style={{
        'text-align': 'left', display: 'flex', 'flex-direction': 'column', gap: '12px', width: '220px',
        background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '16px', cursor: 'pointer', color: TEXT,
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
        <PowerClassIcon class={className()} size={28} color={GPL_TEXT} />
        <div style={{ 'min-width': 0, flex: 1 }}>
          <div style={{ 'font-size': '15px', 'font-weight': 600, 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{props.creep.name}</div>
          <div style={{ 'font-size': '12px', color: MUTED }}>{info().label} · Lvl {props.creep.level}</div>
        </div>
      </div>

      <Show when={assigned().length} fallback={<div style={{ 'font-size': '11px', color: MUTED }}>No powers assigned</div>}>
        <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
          <For each={assigned()}>
            {(def) => (
              <span title={def!.name} style={{ display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', width: '24px', height: '24px', background: PANEL_RAISED, border: `1px solid ${BORDER}`, 'border-radius': '5px' }}>
                <Dynamic component={def!.icon} size={14} color={POWER_RED} />
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.creep.deleteTime}>
        <div style={{ 'font-size': '11px', color: '#f0883e' }}>Scheduled for deletion</div>
      </Show>
    </button>
  )
}

export function PowerCreepList(props: { ctx: PowerContext; loading: boolean; nav?: PowerNav }) {
  const creeps = () => props.ctx.creeps()
  const onNew = () => (props.nav?.goToNew ?? goToUserPowerNew)()
  const onSelect = (id: string) => (props.nav?.goToCreep ?? goToUserPowerCreep)(id)

  return (
    <Show when={!props.loading} fallback={<div style={{ color: MUTED, padding: '32px', 'text-align': 'center' }}>Loading…</div>}>
      <Show
        when={creeps().length}
        fallback={
          /* Empty state — mirrors the vanilla copy, in our palette. */
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '10px', padding: '48px 24px', 'text-align': 'center' }}>
            <div style={{ display: 'flex', 'justify-content': 'center', gap: '28px', 'margin-bottom': '24px' }}>
              <For each={POWER_CREEP_CLASSES}>
                {(cls) => <PowerClassIcon class={cls} size={44} color={cls === 'operator' ? GPL_TEXT : BORDER} />}
              </For>
            </div>
            <p style={{ color: TEXT, 'font-size': '15px', margin: '0 0 6px', 'line-height': '1.5' }}>You have no Power Creeps yet.</p>
            <p style={{ color: MUTED, 'font-size': '13px', margin: '0 0 24px', 'line-height': '1.5' }}>
              You need 1 free Power Level in your account to create a new Power Creep.
            </p>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', gap: '16px' }}>
              <CreateButton free={props.ctx.free()} onNew={onNew} />
              <a href={POWER_DOCS} target="_blank" rel="noopener" style={{ color: '#58a6ff', 'font-size': '13px', 'text-decoration': 'none' }}>Learn more</a>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', 'align-items': 'center', 'margin-bottom': '16px' }}>
          <CreateButton free={props.ctx.free()} onNew={onNew} />
          <div style={{ flex: 1 }} />
          <a href={POWER_DOCS} target="_blank" rel="noopener" style={{ color: '#58a6ff', 'font-size': '13px', 'text-decoration': 'none' }}>Learn more</a>
        </div>
        <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '16px' }}>
          <For each={creeps()}>{(creep) => <CreepCard creep={creep} onSelect={onSelect} />}</For>
        </div>
      </Show>
    </Show>
  )
}
