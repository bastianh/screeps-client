import type { JSX } from 'solid-js'

const BG = '#0d1117'
const TEXT = '#c9d1d9'

export function OverlayPage(props: { children: JSX.Element; maxWidth?: string }) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: BG, color: TEXT }}>
      <div style={{ 'max-width': props.maxWidth ?? '1040px', margin: '0 auto', padding: '24px 16px 48px' }}>
        {props.children}
      </div>
    </div>
  )
}
