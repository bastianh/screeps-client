import { Show } from 'solid-js'
import { rateLimitError, setRateLimitError } from '~/stores/clientStore.js'
import { openExternalUrl } from '~/utils/tauri.js'

// Official servers rate-limit API tokens; the 429 body includes a per-account
// link to disable it. Surfaced as a dismissable popup (rather than the usual
// error toast) so that link stays actionable instead of disappearing in 6s.
export function RateLimitModal() {
  return (
    <Show when={rateLimitError()}>
      {(info) => (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.65)',
            'z-index': 500,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
        >
          <div
            style={{
              width: 'min(480px, calc(100% - 48px))',
              background: '#161b22',
              border: '1px solid #30363d',
              'border-radius': '8px',
              'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.5)',
              padding: '20px',
            }}
          >
            <div style={{ 'font-size': '16px', 'font-weight': 600, color: '#f85149', 'margin-bottom': '12px' }}>
              Rate limit exceeded
            </div>
            <p style={{ 'font-size': '13px', color: '#c9d1d9', 'line-height': '1.5', margin: '0 0 18px', 'word-break': 'break-word' }}>
              {info().message}
            </p>
            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setRateLimitError(null)}
                style={{
                  padding: '7px 14px',
                  'border-radius': '4px',
                  border: '1px solid #30363d',
                  background: '#21262d',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  'font-size': '13px',
                }}
              >
                Close
              </button>
              <Show when={info().disableLink}>
                {(link) => (
                  <button
                    onClick={() => void openExternalUrl(link())}
                    style={{
                      padding: '7px 14px',
                      'border-radius': '4px',
                      border: 'none',
                      background: '#58a6ff',
                      color: '#0d1117',
                      cursor: 'pointer',
                      'font-size': '13px',
                      'font-weight': 600,
                    }}
                  >
                    Disable rate limiting
                  </button>
                )}
              </Show>
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
