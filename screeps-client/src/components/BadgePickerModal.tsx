import { createSignal, createMemo, createEffect, For, untrack } from 'solid-js'
import { badgeToSvg, BadgeColors } from 'screeps-connectivity'
import type { Badge } from 'screeps-connectivity'
import { client } from '~/stores/clientStore.js'
import { addToast } from '~/stores/toastStore.js'

// Pre-generate neutral thumbnails for all 24 badge types once at module load
const TYPE_THUMBNAILS: Record<number, string> = {}
for (let i = 1; i <= 24; i++) {
  const svg = badgeToSvg({ type: i, color1: '#4a5060', color2: '#7a9ec0', color3: '#c0daf0', param: 0, flip: false })
  TYPE_THUMBNAILS[i] = `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function toDisplayHex(color: string | number): string {
  if (typeof color === 'string') return color
  return BadgeColors[color]?.rgb ?? '#000000'
}

function initColor(color: string | number): string | number {
  if (typeof color === 'number') return Math.max(0, Math.min(79, color))
  return color
}

const COLOR_SLOTS = [
  { slot: 1 as const, label: 'Background' },
  { slot: 2 as const, label: 'Primary' },
  { slot: 3 as const, label: 'Secondary' },
]

const TYPE_KEYS = Array.from({ length: 24 }, (_, i) => i + 1)

const HEX_RE = /^#[0-9a-f]{6}$/i

export function BadgePickerModal(props: {
  badge: Badge
  onClose: () => void
}) {
  const [type, setType] = createSignal(untrack(() => typeof props.badge.type === 'number' ? props.badge.type : 1))
  const [color1, setColor1] = createSignal<string | number>(untrack(() => initColor(props.badge.color1)))
  const [color2, setColor2] = createSignal<string | number>(untrack(() => initColor(props.badge.color2)))
  const [color3, setColor3] = createSignal<string | number>(untrack(() => initColor(props.badge.color3)))
  const [param, setParam] = createSignal(untrack(() => props.badge.param ?? 0))
  const [flip, setFlip] = createSignal(untrack(() => props.badge.flip ?? false))
  const [activeSlot, setActiveSlot] = createSignal<1 | 2 | 3>(1)
  const [saving, setSaving] = createSignal(false)
  const [hexDraft, setHexDraft] = createSignal(untrack(() => toDisplayHex(initColor(props.badge.color1))))

  const colorForSlot = (slot: 1 | 2 | 3): string | number => {
    if (slot === 1) return color1()
    if (slot === 2) return color2()
    return color3()
  }

  const setColorForSlot = (value: string | number) => {
    const slot = activeSlot()
    if (slot === 1) setColor1(value)
    else if (slot === 2) setColor2(value)
    else setColor3(value)
  }

  // Keep hex input in sync when switching slots or picking from palette
  createEffect(() => {
    setHexDraft(toDisplayHex(colorForSlot(activeSlot())))
  })

  const isPaletteSelected = (entryIndex: number): boolean => {
    const c = colorForSlot(activeSlot())
    if (typeof c === 'number') return c === entryIndex
    return c.toLowerCase() === (BadgeColors[entryIndex]?.rgb ?? '').toLowerCase()
  }

  const currentBadge = (): Badge => ({
    type: type(),
    color1: toDisplayHex(color1()),
    color2: toDisplayHex(color2()),
    color3: toDisplayHex(color3()),
    param: param(),
    flip: flip(),
  })

  const previewSrc = createMemo(() => {
    const svg = badgeToSvg(currentBadge())
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  })

  const handleHexInput = (raw: string) => {
    setHexDraft(raw)
    if (!HEX_RE.test(raw)) return
    const exact = BadgeColors.findIndex(e => e.rgb.toLowerCase() === raw.toLowerCase())
    setColorForSlot(exact >= 0 ? exact : raw)
  }

  const handleSave = async () => {
    const c = client()
    if (!c) return
    setSaving(true)
    try {
      await c.http.user.badge(currentBadge())
      await c.stores.user.refreshMe()
      props.onClose()
      addToast('Badge saved', 'success', 3000)
    } catch (err) {
      addToast(`Failed to save badge: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    } finally {
      setSaving(false)
    }
  }

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.65)',
        'z-index': 200,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          'border-radius': '10px',
          width: '540px',
          'max-height': '90vh',
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
            padding: '14px 20px',
            'border-bottom': '1px solid #30363d',
            'flex-shrink': 0,
          }}
        >
          <span style={{ 'font-size': '15px', 'font-weight': 600, color: '#c9d1d9' }}>Edit Badge</span>
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
        <div style={{ overflow: 'auto', flex: 1, padding: '20px' }}>

          {/* Preview + Type grid */}
          <div style={{ display: 'flex', gap: '16px', 'margin-bottom': '20px' }}>
            <div style={{ 'flex-shrink': 0 }}>
              <div style={{ 'font-size': '11px', color: '#8b949e', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'margin-bottom': '8px', 'font-weight': 700 }}>
                Preview
              </div>
              <img src={previewSrc()} width={96} height={96} style={{ display: 'block' }} />
            </div>

            <div style={{ flex: 1, 'min-width': 0 }}>
              <div style={{ 'font-size': '11px', color: '#8b949e', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'margin-bottom': '8px', 'font-weight': 700 }}>
                Badge Design
              </div>
              <div style={{ display: 'grid', 'grid-template-columns': 'repeat(6, 1fr)', gap: '4px' }}>
                <For each={TYPE_KEYS}>
                  {(t) => (
                    <button
                      onClick={() => setType(t)}
                      style={{
                        background: type() === t ? '#1f3a2a' : '#0d1117',
                        border: `1px solid ${type() === t ? '#238636' : '#21262d'}`,
                        'border-radius': '4px',
                        padding: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                      }}
                    >
                      <img src={type() === t ? previewSrc() : TYPE_THUMBNAILS[t]} width={48} height={48} style={{ display: 'block' }} />
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div style={{ 'margin-bottom': '20px' }}>
            <div style={{ 'font-size': '11px', color: '#8b949e', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'margin-bottom': '8px', 'font-weight': 700 }}>
              Colors
            </div>

            {/* Color slot tabs */}
            <div style={{ display: 'flex', gap: '6px', 'margin-bottom': '10px' }}>
              <For each={COLOR_SLOTS}>
                {({ slot, label }) => (
                  <button
                    onClick={() => setActiveSlot(slot)}
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      'border-radius': '6px',
                      border: `1px solid ${activeSlot() === slot ? '#58a6ff' : '#30363d'}`,
                      background: activeSlot() === slot ? '#1c2d47' : 'transparent',
                      color: activeSlot() === slot ? '#58a6ff' : '#8b949e',
                      'font-size': '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        'border-radius': '50%',
                        background: toDisplayHex(colorForSlot(slot)),
                        border: '1px solid rgba(255,255,255,0.2)',
                        'flex-shrink': 0,
                      }}
                    />
                    {label}
                  </button>
                )}
              </For>
            </div>

            {/* Palette grid: 4 rows × 20 cols */}
            <div
              style={{
                display: 'grid',
                'grid-template-columns': 'repeat(20, 1fr)',
                gap: '2px',
                'margin-bottom': '10px',
              }}
            >
              <For each={BadgeColors}>
                {(entry) => (
                  <button
                    onClick={() => setColorForSlot(entry.index)}
                    title={entry.rgb}
                    style={{
                      background: entry.rgb,
                      width: '100%',
                      'aspect-ratio': '1',
                      border: isPaletteSelected(entry.index) ? '2px solid #fff' : '1px solid transparent',
                      'border-radius': '2px',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                    }}
                  />
                )}
              </For>
            </div>

            {/* Hex input */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  'border-radius': '4px',
                  background: HEX_RE.test(hexDraft()) ? hexDraft() : toDisplayHex(colorForSlot(activeSlot())),
                  border: '1px solid rgba(255,255,255,0.2)',
                  'flex-shrink': 0,
                }}
              />
              <input
                type="text"
                value={hexDraft()}
                onInput={(e) => handleHexInput(e.currentTarget.value)}
                maxLength={7}
                placeholder="#rrggbb"
                style={{
                  width: '90px',
                  padding: '4px 8px',
                  'border-radius': '4px',
                  border: `1px solid ${HEX_RE.test(hexDraft()) ? '#30363d' : '#f85149'}`,
                  background: '#0d1117',
                  color: '#c9d1d9',
                  'font-size': '12px',
                  'font-family': 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Variation slider */}
          <div style={{ 'margin-bottom': '16px' }}>
            <div style={{ display: 'flex', 'align-items': 'baseline', gap: '8px', 'margin-bottom': '6px' }}>
              <span style={{ 'font-size': '11px', color: '#8b949e', 'text-transform': 'uppercase', 'letter-spacing': '0.06em', 'font-weight': 700 }}>
                Variation
              </span>
              <span style={{ 'font-size': '12px', color: '#c9d1d9' }}>{param()}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={param()}
              onInput={(e) => setParam(+e.currentTarget.value)}
              style={{ width: '100%', 'accent-color': '#58a6ff' }}
            />
          </div>

          {/* Flip toggle */}
          <label
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '8px',
              cursor: 'pointer',
              'font-size': '13px',
              color: '#c9d1d9',
            }}
          >
            <input
              type="checkbox"
              checked={flip()}
              onChange={(e) => setFlip(e.currentTarget.checked)}
              style={{ 'accent-color': '#58a6ff', width: '14px', height: '14px' }}
            />
            Rotate / Flip
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            'justify-content': 'flex-end',
            gap: '8px',
            padding: '14px 20px',
            'border-top': '1px solid #30363d',
            'flex-shrink': 0,
          }}
        >
          <button
            onClick={() => props.onClose()}
            disabled={saving()}
            style={{
              padding: '8px 16px',
              'border-radius': '6px',
              border: '1px solid #30363d',
              background: 'transparent',
              color: '#8b949e',
              'font-size': '13px',
              cursor: saving() ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving()}
            style={{
              padding: '8px 16px',
              'border-radius': '6px',
              border: 'none',
              background: '#238636',
              color: '#fff',
              'font-size': '13px',
              'font-weight': 600,
              cursor: saving() ? 'not-allowed' : 'pointer',
              opacity: saving() ? 0.7 : 1,
            }}
          >
            {saving() ? 'Saving…' : 'Save Badge'}
          </button>
        </div>
      </div>
    </div>
  )
}
