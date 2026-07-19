import { For, Show } from 'solid-js'
import { gameTime } from '~/stores/clientStore.js'
import { roomUsers } from '~/stores/roomDataStore.js'
import { UserLink } from '~/components/UserLink.js'
import { HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { StoreDetails } from './StoreDetails.js'
import { kvCell, kvGrid } from './shared.js'

const BODY_PART_CSS: Record<string, string> = {
  tough:         '#4c4c4c',
  move:          '#a9b7c6',
  work:          '#ffe56d',
  carry:         '#777777',
  attack:        '#f93842',
  ranged_attack: '#5d80b2',
  heal:          '#65fd62',
  claim:         '#b99cfb',
}

export function CreepDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null
  const ownerUsername = () => {
    const uid = userId()
    return uid ? roomUsers()?.[uid]?.username ?? null : null
  }
  const ownerName = () => {
    const uid = userId()
    if (!uid) return null
    return ownerUsername() ?? uid
  }

  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  const ttl = () => {
    const age = raw().ageTime
    const gt = gameTime()
    if (typeof age === 'number' && gt !== null) return Math.max(0, age - gt)
    return null
  }
  const fatigue = () => typeof raw().fatigue === 'number' ? (raw().fatigue as number) : null
  const store = () => raw().store as Record<string, number> | undefined
  const storeCapacity = () => typeof raw().storeCapacity === 'number' ? (raw().storeCapacity as number) : null
  const body = () => (raw().body as Array<{ type: string; hits?: number }> | undefined) ?? []
  const bodyGroups = () => {
    const counts = new Map<string, number>()
    for (const part of body()) counts.set(part.type, (counts.get(part.type) ?? 0) + 1)
    return [...counts.entries()].map(([type, count]) => ({ type, count }))
  }

  return (
    <div>
      <div style={kvGrid}>
        <Show when={ownerName()}>
          <>
            <div style={kvCell(true)}>Owner</div>
            <div style={kvCell()}><UserLink username={ownerUsername()} fallback={ownerName()} /></div>
          </>
        </Show>

        <Show when={hits() !== null && hitsMax() !== null}>
          <>
            <div style={kvCell(true)}>Hits</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
          </>
        </Show>

        <Show when={ttl() !== null}>
          <>
            <div style={kvCell(true)}>Time to live</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{ttl()}</div>
          </>
        </Show>

        <Show when={fatigue() !== null}>
          <>
            <div style={kvCell(true)}>Fatigue</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums', color: fatigue()! > 0 ? '#e3b341' : undefined }}>{fatigue()}</div>
          </>
        </Show>
      </div>

      <HitsBar hits={hits()} max={hitsMax()} />

      <StoreDetails store={store()} capacity={storeCapacity()} />

      <Show when={body().length > 0}>
        <div style={{ background: '#21262d', 'border-top': '1px solid #30363d', 'font-size': '10px' }}>
          <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600 }}>
            Body ({body().length})
          </div>
          <div style={{
            display: 'flex',
            'flex-wrap': 'wrap',
            gap: '3px',
            padding: '8px',
            background: '#0d1117',
          }}>
            <For each={body()}>
              {(part) => (
                <div
                  title={part.type.replace('_', ' ')}
                  style={{
                    width: '11px',
                    height: '11px',
                    'border-radius': '50%',
                    background: BODY_PART_CSS[part.type] ?? '#484f58',
                    opacity: part.hits === 0 ? 0.25 : 1,
                    'flex-shrink': 0,
                  }}
                />
              )}
            </For>
          </div>
          <div style={{
            display: 'flex',
            'flex-wrap': 'wrap',
            gap: '2px 10px',
            padding: '0 8px 8px',
            background: '#0d1117',
          }}>
            <For each={bodyGroups()}>
              {({ type, count }) => (
                <span style={{ 'font-size': '10px', 'font-variant-numeric': 'tabular-nums' }}>
                  <span style={{ color: '#8b949e' }}>{count}×</span>
                  <span style={{ color: BODY_PART_CSS[type] ?? '#484f58' }}>{type.replace('_', ' ').toUpperCase()}</span>
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
