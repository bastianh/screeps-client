import type { JSX } from 'solid-js'

/**
 * Full-window dim overlay with a centered message card, used by popout windows
 * for "host gone" and "map moved back to the main window" states. `children`
 * renders below the message — room for an action button.
 */
export function PopoutOverlay(props: { title: string; message: string; children?: JSX.Element }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: '0',
        background: 'rgba(13, 17, 23, 0.88)',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'z-index': 100,
      }}
    >
      <div
        style={{
          color: '#c9d1d9',
          background: '#161b22',
          border: '1px solid #30363d',
          'border-radius': '6px',
          padding: '16px 24px',
          'font-size': '13px',
          'max-width': '360px',
          'text-align': 'center',
          'line-height': '1.6',
        }}
      >
        <div style={{ 'font-weight': 600, 'margin-bottom': '4px' }}>{props.title}</div>
        <div style={{ color: '#8b949e' }}>{props.message}</div>
        {props.children}
      </div>
    </div>
  )
}
