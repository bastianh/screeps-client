import { type JSX } from 'solid-js'
import { PANEL, PANEL_ALT, BORDER, TEXT } from './theme.js'

// A titled panel that groups a market section, so dense tables read as distinct
// blocks instead of floating on the page background. An optional accent colours
// the title and a left edge bar (used to mark Selling vs Buying).
export function Card(props: { title: string; accent?: string; right?: JSX.Element; children: JSX.Element }): JSX.Element {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${BORDER}`,
        'border-left': props.accent ? `3px solid ${props.accent}` : `1px solid ${BORDER}`,
        'border-radius': '8px',
        'margin-bottom': '16px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', padding: '11px 16px', 'border-bottom': `1px solid ${BORDER}`, background: PANEL_ALT }}>
        <span style={{ 'font-size': '12px', 'font-weight': 600, 'text-transform': 'uppercase', 'letter-spacing': '0.05em', color: props.accent ?? TEXT }}>
          {props.title}
        </span>
        <div style={{ flex: 1 }} />
        {props.right}
      </div>
      <div style={{ padding: '4px 16px 12px' }}>{props.children}</div>
    </div>
  )
}

// Subtle zebra background for dense table rows, keyed by row index.
export function rowBg(index: number): string {
  return index % 2 === 1 ? 'rgba(255, 255, 255, 0.022)' : 'transparent'
}
