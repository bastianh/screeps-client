import { For, Show } from 'solid-js'
import { PANEL, BTN, BORDER, TEXT, MUTED, DIM, GREEN, RED, ACCENT } from '~/components/theme.js'
import { DECORATION_TYPE_LABELS, rarityColor } from '~/components/inventory/sorting.js'
import { DecorationProperties, Row, Section, inputStyle } from '~/components/inventory/DecorationProperties.js'
import { clampPlacement, DEG, type Placement } from '~/components/inventory/positionEditor.js'
import { goToInventory } from '~/stores/routeStore.js'
import {
  cancelDecorationEdit, deactivateDecorationEdit, decorationBusy, decorationDraft,
  draftBounds, draftCapabilities, draftDirty, draftHasFrame, draftPlacement,
  saveDecorationEdit, setDraftPlacement, setDraftProp, startDecorationPlacement,
} from '~/stores/decorationEditStore.js'
import { DecorationPicker } from './DecorationPicker.js'

// Sidebar half of the in-room decoration editor: the numbers behind the frame that is
// being dragged on the canvas, everything the decoration exposes besides its geometry,
// and the actions that end the edit.

/** Geometry fields offered as numbers, so a placement can also be typed exactly. */
const FIELDS = [
  { key: 'x', label: 'X', step: 1 },
  { key: 'y', label: 'Y', step: 1 },
  { key: 'width', label: 'Width', step: 1 },
  { key: 'height', label: 'Height', step: 1 },
] as const

function buttonStyle(kind: 'primary' | 'plain' | 'danger', enabled: boolean) {
  return {
    background: kind === 'primary' && enabled ? GREEN : BTN,
    border: `1px solid ${BORDER}`,
    'border-radius': '6px',
    color: kind === 'danger' ? RED : kind === 'primary' && enabled ? '#fff' : enabled ? TEXT : DIM,
    'font-size': '12px',
    padding: '5px 10px',
    cursor: enabled ? 'pointer' : 'default',
  }
}

export function DecoratePanel() {
  const decoration = () => decorationDraft()?.decoration
  const preview = () => decoration()?.preview?.['128x128'] ?? decoration()?.preview?.original

  const setField = (key: keyof Placement, raw: string) => {
    const value = Number(raw)
    const placement = draftPlacement()
    const bounds = draftBounds()
    if (!placement || !bounds || isNaN(value)) return
    setDraftPlacement(clampPlacement({ ...placement, [key]: value }, bounds))
  }

  const setRotationDegrees = (raw: string) => {
    const degrees = Number(raw)
    const placement = draftPlacement()
    if (!placement || isNaN(degrees)) return
    setDraftPlacement({ ...placement, rotation: degrees / DEG })
  }

  const canSave = () => !decorationBusy() && (draftDirty() || decorationDraft()?.wasActive === false)

  return (
    <Show when={decorationDraft()} fallback={<DecorationPicker />}>
      {(draft) => (
        <div style={{ padding: '8px', overflow: 'auto', 'min-height': 0, flex: 1 }}>
          <div style={{
            display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '10px',
            padding: '6px', background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '6px',
          }}>
            <Show when={preview()}>
              {(src) => <img src={src()} alt="" style={{ width: '28px', height: '28px', 'object-fit': 'contain' }} />}
            </Show>
            <div style={{ 'min-width': 0, flex: 1 }}>
              <div style={{
                'font-size': '12px', 'font-weight': 600, color: rarityColor(draft().decoration.rarity),
                overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap',
              }}>
                {draft().decoration.name ?? DECORATION_TYPE_LABELS[draft().decoration.type] ?? draft().decoration.type}
              </div>
              <div style={{ 'font-size': '10px', color: MUTED }}>
                {DECORATION_TYPE_LABELS[draft().decoration.type] ?? draft().decoration.type}
              </div>
            </div>
          </div>

          <Show when={draftHasFrame() ? draftPlacement() : null} fallback={
            <div style={{ 'font-size': '11px', color: DIM, 'margin-bottom': '10px' }}>
              This decoration has no position to drag — it covers the whole room.
            </div>
          }>
            {(placement) => (
              <Section title="Placement">
                <For each={FIELDS}>
                  {(field) => (
                    <Show when={field.key === 'x' || field.key === 'y'
                      ? draftCapabilities()?.positionable
                      : draftCapabilities()?.resizable}>
                      <Row label={field.label} labelWidth="70px">
                        <input
                          type="number"
                          step={field.step}
                          value={placement()[field.key]}
                          onInput={e => setField(field.key, e.currentTarget.value)}
                          style={{ ...inputStyle, width: '70px' }}
                        />
                      </Row>
                    </Show>
                  )}
                </For>
                <Show when={draftCapabilities()?.rotatable}>
                  <Row label="Rotation" labelWidth="70px">
                    <input
                      type="number"
                      step={1}
                      value={Math.round(placement().rotation * DEG)}
                      onInput={e => setRotationDegrees(e.currentTarget.value)}
                      style={{ ...inputStyle, width: '70px' }}
                    />
                    <span style={{ 'font-size': '11px', color: DIM }}>°</span>
                  </Row>
                </Show>
              </Section>
            )}
          </Show>

          <DecorationProperties
            decoration={draft().decoration}
            active={draft().active}
            hideGeometry={draftHasFrame()}
            labelWidth="70px"
            onSet={setDraftProp}
          />

          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px', 'margin-top': '4px' }}>
            <button onClick={() => void saveDecorationEdit()} disabled={!canSave()} style={buttonStyle('primary', canSave())}>
              {draft().wasActive ? 'Save' : 'Activate'}
            </button>
            <button onClick={cancelDecorationEdit} disabled={decorationBusy()} style={buttonStyle('plain', !decorationBusy())}>
              Cancel
            </button>
            <Show when={draft().wasActive} fallback={
              // Nothing has been placed yet, so backing out returns to the list rather
              // than leaving the mode altogether.
              <button
                onClick={startDecorationPlacement}
                disabled={decorationBusy()}
                style={buttonStyle('plain', !decorationBusy())}
              >
                Pick another
              </button>
            }>
              <button
                onClick={() => void deactivateDecorationEdit()}
                disabled={decorationBusy()}
                style={buttonStyle('danger', !decorationBusy())}
              >
                Deactivate
              </button>
            </Show>
          </div>

          <button
            onClick={() => goToInventory(draft().id)}
            style={{
              background: 'transparent', border: 'none', padding: '8px 0 0',
              color: ACCENT, cursor: 'pointer', 'font-size': '11px',
            }}
          >
            Open in inventory
          </button>
        </div>
      )}
    </Show>
  )
}
