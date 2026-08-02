import { createMemo, For, Show } from 'solid-js'
import type { ApiDecorationProp, ApiRoomDecorationActive, ApiRoomDecorationDef } from 'screeps-connectivity'
import { PANEL_RAISED, BTN, BORDER, TEXT, MUTED, DIM } from '~/components/theme.js'
import { ANIMATION_OPTIONS, editorGroups, joinList, splitList } from './activation.js'

// The editable properties of a decoration — colours, sliders, toggles, the animation
// picker and the creep name filter. Shared by the inventory dialog and the in-room
// editor's sidebar panel so the two never drift apart.

/** Geometry is edited by dragging the frame, so it is kept out of the slider list. */
const GEOMETRY_PROPS = new Set(['x', 'y', 'width', 'height', 'rotation'])

export const inputStyle = {
  background: BTN,
  color: TEXT,
  border: `1px solid ${BORDER}`,
  'border-radius': '6px',
  padding: '3px 6px',
  'font-size': '12px',
}

export function Row(props: { label: string; labelWidth?: string; children: unknown }) {
  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'min-height': '26px' }}>
      <div style={{ 'font-size': '11px', color: MUTED, width: props.labelWidth ?? '130px', 'flex-shrink': 0 }}>
        {props.label}
      </div>
      <div style={{ flex: 1, display: 'flex', 'align-items': 'center', gap: '6px' }}>{props.children as never}</div>
    </div>
  )
}

export function Section(props: { title: string; children: unknown }) {
  return (
    <div style={{ 'margin-bottom': '14px' }}>
      <div style={{
        'font-size': '10px', 'font-weight': 600, color: MUTED,
        'text-transform': 'uppercase', 'letter-spacing': '0.04em', 'margin-bottom': '6px',
      }}>
        {props.title}
      </div>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>{props.children as never}</div>
    </div>
  )
}

function label(name: string, descriptor: ApiDecorationProp): string {
  return descriptor.label ?? name
}

interface PropertiesProps {
  decoration: ApiRoomDecorationDef
  active: ApiRoomDecorationActive
  /** Hide x / y / width / height / rotation, which a placement frame owns instead. */
  hideGeometry: boolean
  /** Width of the label column — the sidebar is narrower than the dialog. */
  labelWidth?: string
  onSet: (name: string, value: unknown) => void
}

export function DecorationProperties(props: PropertiesProps) {
  // The definition is read out of the live draft, so it invalidates on every edit even
  // though the schema itself never changes. Settling on its identity first keeps
  // `editorGroups` from handing `For` a fresh array on each keystroke or slider step —
  // that rebuilt every row, and the browser drops a drag the moment its input is
  // replaced, so a slider let go after a couple of pixels.
  const definition = createMemo(() => props.decoration)
  const groups = createMemo(() => editorGroups(definition()))
  const set = (name: string, value: unknown) => props.onSet(name, value)
  const labelWidth = () => props.labelWidth

  const nameFilter = () => splitList(props.active.nameFilter)
  const addNameFilter = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '' || nameFilter().includes(trimmed)) return
    set('nameFilter', joinList([...nameFilter(), trimmed]))
  }
  const removeNameFilter = (value: string) => {
    set('nameFilter', joinList(nameFilter().filter(f => f !== value)))
  }

  return (
    <>
      <Show when={groups().colors.length > 0}>
        <Section title="Colors">
          <For each={groups().colors}>
            {([name, descriptor]) => (
              <Row label={label(name, descriptor)} labelWidth={labelWidth()}>
                <input
                  type="color"
                  value={typeof props.active[name] === 'string' ? String(props.active[name]) : '#ffffff'}
                  onInput={e => set(name, e.currentTarget.value)}
                  style={{ width: '40px', height: '22px', background: 'transparent', border: `1px solid ${BORDER}`, 'border-radius': '4px', padding: 0 }}
                />
                <span style={{ 'font-size': '11px', color: DIM }}>{String(props.active[name] ?? '')}</span>
              </Row>
            )}
          </For>
        </Section>
      </Show>

      <Show when={groups().ranges.length > 0}>
        <Section title="Values">
          <For each={groups().ranges}>
            {([name, descriptor]) => (
              <Show when={!(props.hideGeometry && GEOMETRY_PROPS.has(name))}>
                <Row label={label(name, descriptor)} labelWidth={labelWidth()}>
                  <input
                    type="range"
                    min={descriptor.min ?? 0}
                    max={descriptor.max ?? 1}
                    step={descriptor.step ?? 0.01}
                    value={Number(props.active[name] ?? descriptor.default ?? 0)}
                    onInput={e => set(name, Number(e.currentTarget.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ 'font-size': '11px', color: DIM, width: '48px', 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>
                    {Number(props.active[name] ?? 0)}
                  </span>
                </Row>
              </Show>
            )}
          </For>
        </Section>
      </Show>

      <Show when={groups().displays.length > 0}>
        <Section title="Display">
          <For each={groups().displays}>
            {([name, descriptor]) => (
              <Row label={label(name, descriptor)} labelWidth={labelWidth()}>
                <input
                  type="checkbox"
                  checked={!!props.active[name]}
                  onChange={e => set(name, e.currentTarget.checked)}
                />
              </Row>
            )}
          </For>
        </Section>
      </Show>

      <Show when={groups().animation}>
        {(entry) => (
          <Section title="Animation">
            <Row label={label(entry()[0], entry()[1])} labelWidth={labelWidth()}>
              <select
                value={String(props.active[entry()[0]] ?? '')}
                onChange={e => set(entry()[0], e.currentTarget.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <For each={ANIMATION_OPTIONS}>
                  {(option) => <option value={option}>{option === '' ? 'None' : option}</option>}
                </For>
              </select>
            </Row>
          </Section>
        )}
      </Show>

      <Show when={props.decoration.type === 'creep'}>
        <Section title="Creep filter">
          <Row label="Names" labelWidth={labelWidth()}>
            <input
              placeholder="Add a filter…"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                addNameFilter(e.currentTarget.value)
                e.currentTarget.value = ''
              }}
            />
          </Row>
          <Show when={nameFilter().length > 0}>
            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}>
              <For each={nameFilter()}>
                {(filter) => (
                  <button
                    onClick={() => removeNameFilter(filter)}
                    title="Remove"
                    style={{
                      background: PANEL_RAISED, border: `1px solid ${BORDER}`, 'border-radius': '10px',
                      color: TEXT, 'font-size': '11px', padding: '1px 8px', cursor: 'pointer',
                    }}
                  >
                    {filter} ×
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Row label="Exclude matches" labelWidth={labelWidth()}>
            <input type="checkbox" checked={!!props.active.exclude} onChange={e => set('exclude', e.currentTarget.checked)} />
          </Row>
          <div style={{ 'font-size': '11px', color: DIM }}>
            An empty filter matches every creep.
          </div>
        </Section>
      </Show>

      <Show when={groups().inputs.length > 0}>
        <Section title="Other">
          <For each={groups().inputs}>
            {([name, descriptor]) => (
              <Show when={name !== 'nameFilter' || props.decoration.type !== 'creep'}>
                <Row label={label(name, descriptor)} labelWidth={labelWidth()}>
                  <input
                    value={String(props.active[name] ?? '')}
                    onInput={e => set(name, e.currentTarget.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </Row>
              </Show>
            )}
          </For>
        </Section>
      </Show>
    </>
  )
}
