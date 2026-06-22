import { Show, createMemo } from 'solid-js'
import { badgeToSvg } from 'screeps-connectivity'
import type { Badge } from 'screeps-connectivity'
import type { RoomInfo } from '~/components/MapViewer.js'

const DENSITY_LABELS = ['Low', 'Medium', 'High', 'Ultra'] as const

function densityLabel(density: number): string {
  return DENSITY_LABELS[density - 1] ?? String(density)
}

function formatSignTime(datetime: number): string {
  const d = new Date(datetime)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  if (sameDay) return `Today at ${time}`
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date}, ${time}`
}

function BadgeIcon(props: { badge: Badge }) {
  const src = createMemo(() => `data:image/svg+xml,${encodeURIComponent(badgeToSvg(props.badge))}`)
  return (
    <img
      src={src()}
      width="12"
      height="12"
      alt=""
      style={{ 'border-radius': '2px', flex: '0 0 auto', display: 'block' }}
    />
  )
}

/** Owner/reservation value cell: badge icon + name, or "None". */
function PlayerValue(props: { name: string | null; badge: Badge | null }) {
  return (
    <Show
      when={props.name}
      fallback={<div style={{ padding: '3px 8px', color: '#484f58' }}>None</div>}
    >
      {(name) => (
        <div
          style={{
            padding: '3px 8px',
            color: '#c9d1d9',
            display: 'flex',
            'align-items': 'center',
            gap: '4px',
            'min-width': 0,
          }}
        >
          <Show when={props.badge}>{(badge) => <BadgeIcon badge={badge()} />}</Show>
          <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{name()}</span>
        </div>
      )}
    </Show>
  )
}

export function RoomInfoBox(props: { label: string; info: RoomInfo | null; dim?: boolean }) {
  return (
    <div
      style={{
        margin: '8px 8px 0',
        border: `1px solid ${props.dim ? '#21262d' : '#30363d'}`,
        'border-radius': '6px',
        overflow: 'hidden',
        opacity: props.dim ? 0.6 : 1,
      }}
    >
      <div
        style={{
          padding: '4px 8px',
          background: '#161b22',
          'border-bottom': '1px solid #21262d',
          'font-size': '10px',
          'font-weight': 600,
          color: '#8b949e',
          'text-transform': 'uppercase',
          'letter-spacing': '0.04em',
        }}
      >
        {props.label}
      </div>
      <Show
        when={props.info}
        fallback={
          <div style={{ padding: '6px 8px', 'font-size': '11px', color: '#484f58', 'font-style': 'italic' }}>
            None
          </div>
        }
      >
        {(info) => (
          <div style={{ 'font-size': '11px' }}>
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '6px',
                padding: '5px 8px',
                'font-weight': 600,
                color: '#c9d1d9',
                'font-size': '12px',
                'border-bottom': '1px solid #21262d',
              }}
            >
              <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                {info().room}
              </span>
              <Show when={info().level}>
                {(level) => (
                  <span
                    title="Controller level"
                    style={{
                      'margin-left': 'auto',
                      padding: '0 7px',
                      'line-height': '17px',
                      background: '#21262d',
                      'border-radius': '4px',
                      color: '#c9d1d9',
                      'font-size': '11px',
                      'font-variant-numeric': 'tabular-nums',
                    }}
                  >
                    {level()}
                  </span>
                )}
              </Show>
            </div>
            <div
              style={{
                display: 'grid',
                'grid-template-columns': 'auto 1fr',
                'align-items': 'center',
                'row-gap': '1px',
                'column-gap': '0',
              }}
            >
              {/* A room is either owned or reserved, never both — show only the relevant row. */}
              <Show
                when={info().reservation}
                fallback={
                  <>
                    <div style={{ padding: '3px 8px', color: '#8b949e' }}>Owner</div>
                    <PlayerValue name={info().owner} badge={info().badge} />
                  </>
                }
              >
                <div style={{ padding: '3px 8px', color: '#8b949e' }}>Reservation</div>
                <PlayerValue name={info().reservation} badge={info().badge} />
              </Show>
              <Show when={info().mineral}>
                <div style={{ padding: '3px 8px', color: '#8b949e' }}>Mineral</div>
                <div style={{ padding: '3px 8px', color: '#79c0ff' }}>{info().mineral}</div>
                <div style={{ padding: '3px 8px', color: '#8b949e' }}>Density</div>
                <div style={{ padding: '3px 8px', color: '#c9d1d9' }}>{densityLabel(info().density ?? 0)}</div>
              </Show>
            </div>
            <Show when={info().sign}>
              {(sign) => (
                <div
                  style={{
                    padding: '5px 8px',
                    'border-top': '1px solid #21262d',
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '3px',
                  }}
                >
                  <div style={{ color: '#8b949e' }}>Sign</div>
                  <div style={{ color: '#c9d1d9', 'font-style': 'italic' }}>&ldquo;{sign().text}&rdquo;</div>
                  <Show when={sign().username || sign().badge}>
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '4px',
                        'align-self': 'flex-end',
                        color: '#8b949e',
                      }}
                    >
                      <span>&mdash;</span>
                      <Show when={sign().badge}>{(badge) => <BadgeIcon badge={badge()} />}</Show>
                      <span>{sign().username}</span>
                    </div>
                  </Show>
                  <div style={{ 'align-self': 'flex-end', color: '#484f58', 'font-size': '10px' }}>
                    {formatSignTime(sign().datetime)}
                  </div>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
