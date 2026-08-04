// Visual editor for the Custom UI ("SCUI") config segment. It edits the same
// JSON document that customUiStore reads (see docs/custom-ui.md) but through a
// structured form: sections for the map / room / object sidebars, one card per
// element, plus a raw-JSON view and a live preview of how the sidebar renders.
// Opened from Settings → Custom UI; it loads and saves the configured segment.
import { createSignal, createMemo, createEffect, onCleanup, For, Index, Show, Switch, Match, type JSX } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { createCodeMirror, createEditorControlledValue } from 'solid-codemirror'
import { basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from 'codemirror'
import {
  uiSegment, uiShard, loadCustomUi, parseConfig, ROOM_STANDINGS,
  type CustomUiElement, type CustomUiElementType, type CustomUiNeed, type CustomUiRoomStanding, type CustomUiShowIf,
} from '~/stores/customUiStore.js'
import { client } from '~/stores/clientStore.js'
import { addToast } from '~/stores/toastStore.js'
import { createLogger } from '~/utils/log.js'
import { LS, getStr, setStr } from '~/utils/storage.js'

const { error } = createLogger('customUiEditor')

const SEGMENT_LIMIT = 100 * 1024

interface EditConfig {
  handler: string
  map: CustomUiElement[]
  room: CustomUiElement[]
  objects: CustomUiElement[]
}

type Section = 'map' | 'room' | 'objects'

// What each sidebar actually evaluates at render time. Offering the rest would
// only let players build elements that can never work: an unsatisfiable `needs`
// leaves the button permanently disabled, an unevaluated `showIf` hides it for
// good, and `needs` in an object card is ignored outright.
interface SectionCaps {
  types: readonly CustomUiElementType[]
  /** Context requirements this sidebar can satisfy; empty hides the whole group. */
  needs: readonly CustomUiNeed[]
  /** `showIf.selType` — only the room sidebar has a selection to test. */
  selType: boolean
  /** `obj` / `owner` filters, which decide what an object card attaches to. */
  objFilter: boolean
}

/** Canonical order the `needs` array is written in, so edits stay stable. */
const NEED_ORDER: readonly CustomUiNeed[] = ['room', 'selection', 'tile']

const SECTION_CAPS: Record<Section, SectionCaps> = {
  // The map has a selected room but no selection and no marked tile
  // (CustomUiPanel.needMet / isVisible short-circuit on mode !== 'room').
  map: { types: ['button', 'select', 'status', 'header'], needs: ['room'], selType: false, objFilter: false },
  room: { types: ['button', 'select', 'status', 'header'], needs: NEED_ORDER, selType: true, objFilter: false },
  // Object cards always render inside a room on a selected object, so the
  // context is implicit — CustomObjectActions honours confirm and the obj/owner
  // filters, nothing else.
  objects: { types: ['button', 'select'], needs: [], selType: false, objFilter: true },
}

// Header children are their section minus nesting; precomputed so the caps
// objects stay referentially stable across renders.
const CHILD_CAPS: Record<Section, SectionCaps> = {
  map: { ...SECTION_CAPS.map, types: SECTION_CAPS.map.types.filter((t) => t !== 'header') },
  room: { ...SECTION_CAPS.room, types: SECTION_CAPS.room.types.filter((t) => t !== 'header') },
  objects: { ...SECTION_CAPS.objects, types: SECTION_CAPS.objects.types.filter((t) => t !== 'header') },
}

function capsFor(section: Section, nested: boolean): SectionCaps {
  return (nested ? CHILD_CAPS : SECTION_CAPS)[section]
}

function defaultConfig(): EditConfig {
  return { handler: 'uiCommand', map: [], room: [], objects: [] }
}

function newElement(type: CustomUiElementType): CustomUiElement {
  switch (type) {
    case 'select': return { type, label: 'New select', cmd: 'command', options: ['alpha', 'beta'] }
    case 'status': return { type, label: 'New status', path: 'stats.energy' }
    case 'header': return { type, label: 'New header', items: [] }
    default: return { type: 'button', label: 'New button', cmd: 'command' }
  }
}

// ---- JSON <-> form model -------------------------------------------------

// Normalizing on the way in keeps the form model free of fields the section
// cannot use, so form, preview and serialized JSON always agree. Dropping them
// here is a fix rather than a loss: the renderer ignores them anyway, and a
// stray `showIf.selType` on the map is what made an element invisible.
function elementFromRaw(raw: unknown, caps: SectionCaps, section: Section): CustomUiElement {
  const e = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const type = caps.types.includes(e.type as CustomUiElementType) ? (e.type as CustomUiElementType) : 'button'
  const el: CustomUiElement = { type, label: typeof e.label === 'string' ? e.label : '' }
  if (typeof e.cmd === 'string') el.cmd = e.cmd
  if (Array.isArray(e.options)) el.options = e.options.filter((o): o is string => typeof o === 'string')
  if (typeof e.path === 'string') el.path = e.path
  if (Array.isArray(e.items)) {
    const childCaps = capsFor(section, true)
    el.items = e.items.map((x) => elementFromRaw(x, childCaps, section))
  }
  if (caps.objFilter && e.obj !== undefined) {
    el.obj = (Array.isArray(e.obj) ? e.obj : [e.obj]).filter((o): o is string => typeof o === 'string')
  }
  if (caps.objFilter && (e.owner === 'own' || e.owner === 'foreign')) el.owner = e.owner
  if (caps.needs.length > 0 && Array.isArray(e.needs)) {
    el.needs = e.needs.filter((n): n is CustomUiNeed => caps.needs.includes(n as CustomUiNeed))
  }
  if (e.confirm === true) el.confirm = true
  if (typeof e.showIf === 'object' && e.showIf !== null) {
    const s = e.showIf as Record<string, unknown>
    const showIf: CustomUiShowIf = {}
    if (caps.selType && typeof s.selType === 'string') showIf.selType = s.selType
    if (s.room !== undefined) {
      const list = (Array.isArray(s.room) ? s.room : [s.room])
        .filter((r): r is CustomUiRoomStanding => ROOM_STANDINGS.includes(r as CustomUiRoomStanding))
      if (list.length) showIf.room = list
    }
    if (showIf.selType !== undefined || showIf.room !== undefined) el.showIf = showIf
  }
  return el
}

/** True when the parsed JSON at least looks like a Custom UI config. */
function looksLikeConfig(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const c = raw as Record<string, unknown>
  return 'handler' in c || 'map' in c || 'room' in c || 'objects' in c
}

function sectionFromRaw(raw: unknown, section: Section): CustomUiElement[] {
  if (!Array.isArray(raw)) return []
  const caps = SECTION_CAPS[section]
  return raw.map((x) => elementFromRaw(x, caps, section))
}

function configFromRaw(raw: unknown): EditConfig {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    handler: typeof c.handler === 'string' ? c.handler : '',
    map: sectionFromRaw(c.map, 'map'),
    room: sectionFromRaw(c.room, 'room'),
    objects: sectionFromRaw(c.objects, 'objects'),
  }
}

function elementToRaw(el: CustomUiElement, caps: SectionCaps, section: Section): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  if (el.type !== 'button') o.type = el.type
  o.label = el.label
  if (el.type === 'button' || el.type === 'select') o.cmd = el.cmd ?? ''
  if (el.type === 'select') o.options = el.options ?? []
  if (el.type === 'status') o.path = el.path ?? ''
  if (el.type === 'header') {
    const childCaps = capsFor(section, true)
    o.items = (el.items ?? []).map((c) => elementToRaw(c, childCaps, section))
  }
  if (caps.objFilter && el.obj !== undefined) o.obj = el.obj.length === 1 ? el.obj[0] : el.obj
  if (caps.objFilter && el.owner !== undefined) o.owner = el.owner
  if (el.needs && el.needs.length > 0) o.needs = el.needs
  if (el.confirm) o.confirm = true
  if (el.showIf) {
    const s: Record<string, unknown> = {}
    if (el.showIf.selType) s.selType = el.showIf.selType
    if (el.showIf.room && el.showIf.room.length > 0) s.room = el.showIf.room.length === 1 ? el.showIf.room[0] : el.showIf.room
    if (Object.keys(s).length > 0) o.showIf = s
  }
  return o
}

function sectionToRaw(items: CustomUiElement[], section: Section): Record<string, unknown>[] {
  const caps = SECTION_CAPS[section]
  return items.map((el) => elementToRaw(el, caps, section))
}

function configToJson(cfg: EditConfig): string {
  return JSON.stringify(
    {
      v: 1,
      handler: cfg.handler,
      map: sectionToRaw(cfg.map, 'map'),
      room: sectionToRaw(cfg.room, 'room'),
      objects: sectionToRaw(cfg.objects, 'objects'),
    },
    null,
    2,
  )
}

// ---- shared styles -------------------------------------------------------

const editorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': {
    'font-family': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    'font-size': '13px',
    'line-height': '1.6',
    overflow: 'auto',
  },
  '.cm-gutters': { background: '#0d1117', 'border-right': '1px solid #21262d' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#484f58', 'min-width': '3em' },
  '.cm-activeLineGutter': { background: '#161b22' },
  '.cm-activeLine': { background: '#161b22' },
})

const headerBtnStyle = (enabled: boolean) => ({
  padding: '4px 10px',
  'border-radius': '4px',
  border: '1px solid #30363d',
  background: '#161b22',
  color: enabled ? '#c9d1d9' : '#484f58',
  'font-size': '12px',
  cursor: enabled ? 'pointer' : 'default',
} as const)

const inputStyle = {
  background: '#0d1117',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  'border-radius': '4px',
  padding: '4px 8px',
  'font-size': '12px',
  width: '100%',
  'box-sizing': 'border-box',
} as const

const labelStyle = {
  'font-size': '10px',
  'font-weight': 700,
  color: '#8b949e',
  'text-transform': 'uppercase',
  'letter-spacing': '0.05em',
} as const

const chipBtn = (active: boolean) => ({
  padding: '3px 8px',
  'border-radius': '4px',
  border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
  background: active ? '#1f3158' : '#161b22',
  color: active ? '#58a6ff' : '#8b949e',
  'font-size': '11px',
  cursor: 'pointer',
} as const)

// ---- small building blocks ----------------------------------------------

function Field(props: { label: string; children: JSX.Element }) {
  return (
    <label style={{ display: 'flex', 'flex-direction': 'column', gap: '3px', flex: 1, 'min-width': '120px' }}>
      <span style={labelStyle}>{props.label}</span>
      {props.children}
    </label>
  )
}

function TextInput(props: { value: string; placeholder?: string; onInput: (v: string) => void }) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      style={inputStyle}
    />
  )
}

// Editable list of short strings (select options, object types).
function StringList(props: { values: string[]; addLabel: string; placeholder?: string; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
      {/* `Index` rather than `For`: the rows are keyed by position, so editing a
          value updates the existing input instead of dropping it for a fresh one —
          which is what made the field lose focus on every keystroke. */}
      <Index each={props.values}>
        {(v, i) => (
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              value={v()}
              placeholder={props.placeholder}
              onInput={(e) => props.onChange(props.values.map((x, j) => (j === i ? e.currentTarget.value : x)))}
              style={inputStyle}
            />
            <button
              onClick={() => props.onChange(props.values.filter((_, j) => j !== i))}
              title="Remove"
              style={{ ...headerBtnStyle(true), 'flex-shrink': 0, padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        )}
      </Index>
      <button
        onClick={() => props.onChange([...props.values, ''])}
        style={{ ...headerBtnStyle(true), 'align-self': 'flex-start', color: '#58a6ff' }}
      >
        + {props.addLabel}
      </button>
    </div>
  )
}

function Checkbox(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', 'align-items': 'center', gap: '5px', 'font-size': '12px', color: '#c9d1d9', cursor: 'pointer' }}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      {props.label}
    </label>
  )
}

// ---- element card --------------------------------------------------------

interface ElementCardProps {
  el: CustomUiElement
  index: number
  count: number
  section: Section
  /** Header children: same section, minus the option to nest another header. */
  nested: boolean
  onEdit: (fn: (el: CustomUiElement) => void) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}

function ElementCard(props: ElementCardProps) {
  const [open, setOpen] = createSignal(true)
  const caps = () => capsFor(props.section, props.nested)

  const setType = (type: CustomUiElementType) =>
    props.onEdit((el) => {
      el.type = type
      // Seed the fields a fresh element of this type would carry.
      if (type === 'select' && !el.options) el.options = ['alpha', 'beta']
      if ((type === 'button' || type === 'select') && el.cmd === undefined) el.cmd = 'command'
      if (type === 'status' && el.path === undefined) el.path = 'stats.energy'
      if (type === 'header' && !el.items) el.items = []
    })

  const summary = () => {
    const el = props.el
    const bits = [el.label || '(no label)']
    if (el.cmd) bits.push(`→ ${el.cmd}`)
    if (el.path) bits.push(`= ${el.path}`)
    return bits.join('  ')
  }

  return (
    <div style={{ border: '1px solid #21262d', 'border-radius': '6px', background: '#0d1117', overflow: 'hidden' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '6px 8px', background: '#161b22' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', 'font-size': '11px', width: '14px' }}
        >
          {open() ? '▾' : '▸'}
        </button>
        <span
          style={{
            'font-size': '10px',
            'font-weight': 700,
            'text-transform': 'uppercase',
            color: '#58a6ff',
            'flex-shrink': 0,
          }}
        >
          {props.el.type}
        </span>
        <span
          style={{
            flex: 1,
            'font-size': '12px',
            color: '#c9d1d9',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
          }}
        >
          {summary()}
        </span>
        <button onClick={() => props.onMove(-1)} disabled={props.index === 0} title="Move up" style={{ ...headerBtnStyle(props.index !== 0), padding: '2px 7px' }}>↑</button>
        <button onClick={() => props.onMove(1)} disabled={props.index === props.count - 1} title="Move down" style={{ ...headerBtnStyle(props.index !== props.count - 1), padding: '2px 7px' }}>↓</button>
        <button onClick={() => props.onRemove()} title="Remove element" style={{ ...headerBtnStyle(true), padding: '2px 7px', color: '#f85149' }}>✕</button>
      </div>

      <Show when={open()}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px', padding: '10px' }}>
          {/* Type + label */}
          <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
            <Field label="Type">
              <select value={props.el.type} onChange={(e) => setType(e.currentTarget.value as CustomUiElementType)} style={inputStyle}>
                <For each={caps().types}>{(t) => <option value={t}>{t}</option>}</For>
              </select>
            </Field>
            <Field label="Label">
              <TextInput value={props.el.label} placeholder="Button text" onInput={(v) => props.onEdit((el) => (el.label = v))} />
            </Field>
          </div>

          {/* Command (button / select) */}
          <Show when={props.el.type === 'button' || props.el.type === 'select'}>
            <Field label="Command (cmd)">
              <TextInput value={props.el.cmd ?? ''} placeholder="passed to your handler" onInput={(v) => props.onEdit((el) => (el.cmd = v))} />
            </Field>
          </Show>

          {/* Options (select) */}
          <Show when={props.el.type === 'select'}>
            <Field label="Options">
              <StringList
                values={props.el.options ?? []}
                addLabel="option"
                placeholder="choice sent as value"
                onChange={(v) => props.onEdit((el) => (el.options = v))}
              />
            </Field>
          </Show>

          {/* Path (status) */}
          <Show when={props.el.type === 'status'}>
            <Field label="Memory path">
              <TextInput value={props.el.path ?? ''} placeholder="stats.energy" onInput={(v) => props.onEdit((el) => (el.path = v))} />
            </Field>
          </Show>

          {/* Object types + owner (objects section) */}
          <Show when={caps().objFilter}>
            <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
              <Field label="Object types (obj)">
                <StringList
                  values={props.el.obj ?? []}
                  addLabel="type"
                  placeholder="creep, powerBank …"
                  onChange={(v) => props.onEdit((el) => (el.obj = v))}
                />
              </Field>
              <Field label="Owner filter">
                <select
                  value={props.el.owner ?? ''}
                  onChange={(e) => props.onEdit((el) => (el.owner = (e.currentTarget.value || undefined) as CustomUiElement['owner']))}
                  style={inputStyle}
                >
                  <option value="">any</option>
                  <option value="own">own</option>
                  <option value="foreign">foreign</option>
                </select>
              </Field>
            </div>
          </Show>

          {/* needs + confirm (button / select). `needs` is dropped entirely in
              the objects section, where the renderer never evaluates it. */}
          <Show when={props.el.type === 'button' || props.el.type === 'select'}>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
              <Show when={caps().needs.length > 0}>
                <span style={labelStyle}>Requires (needs)</span>
              </Show>
              <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
                <For each={caps().needs}>
                  {(n) => (
                    <Checkbox
                      label={n}
                      checked={props.el.needs?.includes(n) ?? false}
                      onChange={(on) =>
                        props.onEdit((el) => {
                          const set = new Set(el.needs ?? [])
                          if (on) set.add(n)
                          else set.delete(n)
                          // Ordering only; the set can hold nothing the section doesn't offer.
                          el.needs = set.size ? NEED_ORDER.filter((x) => set.has(x)) : undefined
                        })
                      }
                    />
                  )}
                </For>
                <Checkbox label="confirm" checked={props.el.confirm ?? false} onChange={(on) => props.onEdit((el) => (el.confirm = on || undefined))} />
              </div>
            </div>
          </Show>

          {/* showIf */}
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <span style={labelStyle}>Visible when (showIf)</span>
            <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'flex-end' }}>
              <Show when={caps().selType}>
                <Field label="Selected type (selType)">
                  <TextInput
                    value={props.el.showIf?.selType ?? ''}
                    placeholder="creep, tower …"
                    onInput={(v) =>
                      props.onEdit((el) => {
                        const showIf = { ...el.showIf }
                        if (v.trim()) showIf.selType = v
                        else delete showIf.selType
                        el.showIf = showIf.selType !== undefined || showIf.room !== undefined ? showIf : undefined
                      })
                    }
                  />
                </Field>
              </Show>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                <span style={labelStyle}>Room standing</span>
                <div style={{ display: 'flex', gap: '5px', 'flex-wrap': 'wrap' }}>
                  <For each={ROOM_STANDINGS}>
                    {(r) => {
                      const active = () => props.el.showIf?.room?.includes(r) ?? false
                      return (
                        <button
                          onClick={() =>
                            props.onEdit((el) => {
                              const set = new Set(el.showIf?.room ?? [])
                              if (set.has(r)) set.delete(r)
                              else set.add(r)
                              const room = set.size ? ROOM_STANDINGS.filter((x) => set.has(x)) : undefined
                              const showIf: CustomUiShowIf = { ...el.showIf }
                              if (room) showIf.room = room
                              else delete showIf.room
                              el.showIf = showIf.selType !== undefined || showIf.room !== undefined ? showIf : undefined
                            })
                          }
                          style={chipBtn(active())}
                        >
                          {r}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            </div>
          </div>

          {/* Header children */}
          <Show when={props.el.type === 'header'}>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px', 'border-left': '2px solid #21262d', 'padding-left': '10px' }}>
              <span style={labelStyle}>Items</span>
              <ElementList
                items={props.el.items ?? []}
                section={props.section}
                nested
                mutate={(fn) => props.onEdit((el) => { el.items ??= []; fn(el.items) })}
              />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

// ---- element list (recursive) --------------------------------------------

interface ElementListProps {
  items: CustomUiElement[]
  section: Section
  nested: boolean
  mutate: (fn: (arr: CustomUiElement[]) => void) => void
}

function ElementList(props: ElementListProps) {
  const caps = () => capsFor(props.section, props.nested)

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
      <For each={props.items}>
        {(el, i) => {
          // These fire as event handlers, so reading the live index i() is intended.
          /* eslint-disable solid/reactivity */
          const onEdit = (fn: (e: CustomUiElement) => void) => props.mutate((arr) => fn(arr[i()]))
          const onRemove = () => props.mutate((arr) => arr.splice(i(), 1))
          const onMove = (dir: -1 | 1) =>
            props.mutate((arr) => {
              const j = i() + dir
              if (j < 0 || j >= arr.length) return
              const tmp = arr[i()]
              arr[i()] = arr[j]
              arr[j] = tmp
            })
          /* eslint-enable solid/reactivity */
          return (
            <ElementCard
              el={el}
              index={i()}
              count={props.items.length}
              section={props.section}
              nested={props.nested}
              onEdit={onEdit}
              onRemove={onRemove}
              onMove={onMove}
            />
          )
        }}
      </For>
      <Show when={props.items.length === 0}>
        <div style={{ 'font-size': '12px', color: '#484f58', 'font-style': 'italic', padding: '2px 0' }}>No elements yet.</div>
      </Show>
      <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
        <For each={caps().types}>
          {(t) => (
            <button
              onClick={() => props.mutate((arr) => arr.push(newElement(t)))}
              style={{ ...headerBtnStyle(true), color: '#3fb950', 'border-color': '#238636' }}
            >
              + {t}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

// ---- live preview --------------------------------------------------------

function PreviewButton(props: { el: CustomUiElement; indent?: boolean }) {
  const hint = () => {
    const bits: string[] = []
    if (props.el.needs?.length) bits.push(`needs ${props.el.needs.join(', ')}`)
    if (props.el.confirm) bits.push('confirm')
    if (props.el.showIf?.selType) bits.push(`selType=${props.el.showIf.selType}`)
    if (props.el.showIf?.room?.length) bits.push(props.el.showIf.room.join('/'))
    return bits.join(' · ')
  }
  return (
    <div style={{ 'margin-left': props.indent ? '10px' : '0' }}>
      <Switch>
        <Match when={props.el.type === 'header'}>
          <div style={{ ...labelStyle, 'border-bottom': '1px solid #21262d', 'padding-bottom': '2px', 'margin-top': '4px' }}>{props.el.label}</div>
          <For each={props.el.items ?? []}>{(c) => <PreviewButton el={c} indent />}</For>
        </Match>
        <Match when={props.el.type === 'status'}>
          <div style={{ display: 'flex', 'justify-content': 'space-between', gap: '8px', 'font-size': '12px', padding: '1px 0' }}>
            <span style={{ color: '#8b949e' }}>{props.el.label}</span>
            <span style={{ color: '#c9d1d9', 'font-family': 'monospace' }}>—</span>
          </div>
        </Match>
        <Match when={props.el.type === 'select'}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <select disabled style={{ flex: 1, 'min-width': 0, ...inputStyle, background: '#161b22' }}>
              <For each={props.el.options ?? []}>{(o) => <option>{o}</option>}</For>
            </select>
            <button disabled style={{ ...headerBtnStyle(false), background: '#21262d' }}>{props.el.label}</button>
          </div>
        </Match>
        <Match when={props.el.type === 'button'}>
          <button
            disabled
            style={{ ...headerBtnStyle(true), width: '100%', 'text-align': 'left', background: '#21262d', color: '#c9d1d9', cursor: 'default' }}
          >
            {props.el.label}
          </button>
        </Match>
      </Switch>
      <Show when={hint()}>
        <div style={{ 'font-size': '10px', color: '#484f58', 'margin-top': '1px' }}>{hint()}</div>
      </Show>
    </div>
  )
}

function PreviewSection(props: { title: string; items: CustomUiElement[] }) {
  return (
    <div style={{ 'border-top': '1px solid #30363d', padding: '8px 10px' }}>
      <div style={{ ...labelStyle, 'margin-bottom': '6px' }}>{props.title}</div>
      <Show
        when={props.items.length > 0}
        fallback={<div style={{ 'font-size': '11px', color: '#484f58', 'font-style': 'italic' }}>—</div>}
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <For each={props.items}>{(el) => <PreviewButton el={el} />}</For>
        </div>
      </Show>
    </div>
  )
}

// ---- main panel ----------------------------------------------------------

export function CustomUiEditor(props: { onClose: () => void }) {
  const segment = uiSegment
  const shard = () => uiShard() || null

  const [config, setConfig] = createStore<EditConfig>(defaultConfig())
  const [view, setView] = createSignal<'form' | 'json'>(getStr(LS.customUiEditorView) === 'json' ? 'json' : 'form')
  const [jsonText, setJsonText] = createSignal('')
  const [dirty, setDirty] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [reloadTick, setReloadTick] = createSignal(0)
  const [loadNote, setLoadNote] = createSignal<string | null>(null)

  createEffect(() => setStr(LS.customUiEditorView, view()))

  // JSON produced from the form model — the source of truth in form view.
  const serialized = createMemo(() => configToJson(config))

  const mutate = (fn: (c: EditConfig) => void) => {
    setConfig(produce(fn))
    setDirty(true)
  }

  const charCount = () => (view() === 'json' ? jsonText().length : serialized().length)
  const overLimit = () => charCount() > SEGMENT_LIMIT

  // --- JSON editor ---
  const { editorView, ref: editorRef, createExtension } = createCodeMirror({
    onValueChange: (value) => {
      if (jsonText() === value) return
      setJsonText(value)
      setDirty(true)
    },
  })
  createEditorControlledValue(editorView, jsonText)
  createExtension([basicSetup, oneDark, editorTheme, json(), EditorView.lineWrapping])

  // --- load the configured segment ---
  createEffect(() => {
    const c = client()
    const seg = segment()
    const s = shard()
    reloadTick()
    if (!c || seg === null) return
    let stale = false
    onCleanup(() => { stale = true })
    setLoading(true)
    setLoadNote(null)
    c.http.user.memory.segment.get(seg, s)
      .then((res) => {
        if (stale) return
        const data = res.data ?? ''
        if (!data.trim()) {
          setConfig(defaultConfig())
          setView('form')
        } else {
          try {
            const raw = JSON.parse(data)
            if (!looksLikeConfig(raw)) throw new Error('not a Custom UI config')
            setConfig(configFromRaw(raw))
            setView('form')
          } catch {
            // Keep the raw text so the user can inspect / fix it by hand.
            setJsonText(data)
            setView('json')
            setLoadNote(`Segment ${seg} isn’t valid Custom UI JSON — showing the raw contents.`)
          }
        }
        setDirty(false)
      })
      .catch((err) => {
        if (stale) return
        error('segment load failed:', err)
        addToast(`Failed to load segment ${seg}`, 'error')
      })
      .finally(() => { if (!stale) setLoading(false) })
  })

  // Seed the JSON editor whenever it becomes visible so it reflects the form.
  createEffect(() => {
    if (view() === 'json' && !loadNote()) setJsonText(serialized())
  })

  const switchToForm = () => {
    try {
      const raw = JSON.parse(jsonText())
      setConfig(configFromRaw(raw))
      setLoadNote(null)
      setView('form')
    } catch {
      addToast('JSON is not valid — fix it before switching to the form', 'error')
    }
  }

  const switchToJson = () => {
    setJsonText(serialized())
    setLoadNote(null)
    setView('json')
  }

  const handleReload = () => {
    if (dirty() && !confirm('Discard unsaved changes and reload from the segment?')) return
    setReloadTick((t) => t + 1)
  }

  const handleSave = () => {
    const c = client()
    const seg = segment()
    if (!c || seg === null) return
    const text = view() === 'json' ? jsonText() : serialized()
    try {
      parseConfig(text)
    } catch (err) {
      addToast(`Invalid config: ${(err as Error).message}`, 'error')
      return
    }
    setSaving(true)
    c.http.user.memory.segment.set(seg, text, shard())
      .then(() => {
        addToast(`Custom UI saved to segment ${seg}`, 'success')
        setDirty(false)
        // Refresh the live sidebar config if this is the active segment.
        void loadCustomUi()
      })
      .catch((err) => {
        error('segment save failed:', err)
        addToast(`Failed to save segment ${seg}`, 'error')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: '0px',
        background: '#0d1117',
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
          gap: '8px',
          padding: '10px 16px',
          'border-bottom': '1px solid #30363d',
          'flex-shrink': 0,
        }}
      >
        <span style={{ 'font-size': '15px', 'font-weight': 600, color: '#c9d1d9' }}>Custom UI</span>
        <span style={{ 'font-size': '12px', color: '#8b949e' }}>
          Segment {segment()}{shard() ? ` · ${shard()}` : ''}
        </span>

        <div style={{ display: 'flex', gap: '2px', 'margin-left': '8px' }}>
          <button onClick={switchToForm} style={{ ...headerBtnStyle(true), ...(view() === 'form' ? { background: '#1f3158', color: '#58a6ff', 'border-color': '#388bfd' } : {}) }}>
            Form
          </button>
          <button onClick={switchToJson} style={{ ...headerBtnStyle(true), ...(view() === 'json' ? { background: '#1f3158', color: '#58a6ff', 'border-color': '#388bfd' } : {}) }}>
            JSON
          </button>
        </div>

        <button onClick={handleReload} disabled={loading()} style={headerBtnStyle(!loading())}>Reload</button>

        <div style={{ flex: 1 }} />

        <span style={{ 'font-size': '11px', color: overLimit() ? '#f85149' : '#8b949e' }}>
          {charCount().toLocaleString()} / {SEGMENT_LIMIT.toLocaleString()} chars
        </span>
        <Show when={dirty()}>
          <span style={{ 'font-size': '11px', color: '#e3b341' }}>Unsaved changes</span>
        </Show>

        <button
          onClick={handleSave}
          disabled={saving() || loading() || !dirty() || overLimit()}
          title={overLimit() ? 'Content exceeds the 100 KB segment limit' : 'Save this config to the segment'}
          style={{
            padding: '5px 14px',
            'border-radius': '4px',
            border: '1px solid #238636',
            background: saving() || !dirty() || overLimit() ? '#161b22' : '#1a3a2a',
            color: saving() || !dirty() || overLimit() ? '#484f58' : '#3fb950',
            'font-size': '12px',
            cursor: saving() || !dirty() || overLimit() ? 'default' : 'pointer',
            'font-weight': 600,
          }}
        >
          {saving() ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={() => props.onClose()}
          style={{ background: 'transparent', border: 'none', color: '#8b949e', 'font-size': '18px', cursor: 'pointer', 'line-height': '1', padding: '2px 6px' }}
        >
          ✕
        </button>
      </div>

      <Show when={loadNote()}>
        <div style={{ padding: '8px 16px', 'font-size': '12px', color: '#e3b341', background: '#1a1a0d', 'border-bottom': '1px solid #30363d' }}>
          {loadNote()}
        </div>
      </Show>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Form column (kept mounted; hidden in JSON view) */}
        <div style={{ flex: 1, overflow: 'auto', display: view() === 'form' ? 'block' : 'none' }}>
          <div style={{ padding: '16px', display: 'flex', 'flex-direction': 'column', gap: '18px', 'max-width': '760px' }}>
            <Field label="Handler function">
              <TextInput value={config.handler} placeholder="uiCommand" onInput={(v) => mutate((c) => (c.handler = v))} />
            </Field>

            <SectionBlock title="Map sidebar" hint="Buttons shown on the world map. No selection or tile context here.">
              <ElementList items={config.map} section="map" nested={false} mutate={(fn) => mutate((c) => fn(c.map))} />
            </SectionBlock>

            <SectionBlock title="Room sidebar" hint="Elements shown while viewing a room.">
              <ElementList items={config.room} section="room" nested={false} mutate={(fn) => mutate((c) => fn(c.room))} />
            </SectionBlock>

            <SectionBlock title="Object actions" hint="Buttons inside a selected object’s card; the object supplies the context.">
              <ElementList items={config.objects} section="objects" nested={false} mutate={(fn) => mutate((c) => fn(c.objects))} />
            </SectionBlock>
          </div>
        </div>

        {/* JSON column (kept mounted; hidden in form view) */}
        <div style={{ flex: 1, overflow: 'hidden', display: view() === 'json' ? 'flex' : 'none', 'flex-direction': 'column' }}>
          <div ref={editorRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }} />
        </div>

        {/* Preview column */}
        <div style={{ width: '260px', 'flex-shrink': 0, 'border-left': '1px solid #21262d', overflow: 'auto', background: '#0d1117' }}>
          <div style={{ padding: '10px', ...labelStyle }}>Preview</div>
          <PreviewSection title="Map" items={config.map} />
          <PreviewSection title="Room" items={config.room} />
          <PreviewSection title="Object actions" items={config.objects} />
          <div style={{ padding: '10px', 'font-size': '10px', color: '#484f58', 'line-height': '1.5' }}>
            Static preview — showIf/needs are listed as hints but not applied.
          </div>
        </div>

        <Show when={loading()}>
          <div
            style={{
              position: 'absolute',
              inset: '0px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              background: 'rgba(13,17,23,0.7)',
              color: '#484f58',
              'font-size': '13px',
              'font-style': 'italic',
            }}
          >
            Loading segment {segment()}…
          </div>
        </Show>
      </div>
    </div>
  )
}

function SectionBlock(props: { title: string; hint: string; children: JSX.Element }) {
  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
      <div>
        <div style={{ 'font-size': '13px', 'font-weight': 600, color: '#c9d1d9' }}>{props.title}</div>
        <div style={{ 'font-size': '11px', color: '#8b949e', 'margin-top': '2px' }}>{props.hint}</div>
      </div>
      {props.children}
    </div>
  )
}
