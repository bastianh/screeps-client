import { onCleanup, onMount } from 'solid-js'
import { X } from 'lucide-solid'

// Auto-dismiss delay; paused while the pointer is over the message so it can be read.
const AUTO_DISMISS_MS = 15000

// Server message-of-the-day shown centered over the map after connecting (guest
// sessions). The text is server-provided HTML, same as the login screen.
export function MotdOverlay(props: { text: string; onClose: () => void }) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const start = () => {
    stop()
    timer = setTimeout(() => props.onClose(), AUTO_DISMISS_MS)
  }

  onMount(start)
  onCleanup(stop)

  return (
    <div
      onMouseEnter={stop}
      onMouseLeave={start}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        'max-width': 'min(520px, calc(100% - 48px))',
        'max-height': 'calc(100% - 48px)',
        'z-index': 20,
        display: 'flex',
        background: '#161b22',
        border: '1px solid #30363d',
        'border-radius': '8px',
        'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
        animation: 'motd-in 0.25s ease',
      }}
    >
      <button
        title="Dismiss"
        onClick={() => props.onClose()}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px',
          'border-radius': '4px',
          border: 'none',
          background: 'transparent',
          color: '#8b949e',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
        }}
      >
        <X size={16} />
      </button>
      <div
        style={{
          padding: '20px 36px 20px 20px',
          overflow: 'auto',
          color: '#c9d1d9',
          'font-size': '13px',
          'line-height': '1.6',
        }}
        // eslint-disable-next-line solid/no-innerhtml
        innerHTML={props.text}
      />
    </div>
  )
}
