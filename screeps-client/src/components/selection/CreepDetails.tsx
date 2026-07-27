import { For, Show, createMemo } from 'solid-js'
import { gameTime } from '~/stores/clientStore.js'
import { roomUsers, roomDecorationItems } from '~/stores/roomDataStore.js'
import { parseRoomDecorations, creepMatchesDecoration } from '~/renderer/roomDecorations.js'
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

  // Which of the room's creep decorations actually land on this creep. Same owner,
  // same name-filter rules the renderer applies — reusing that keeps the panel from
  // drifting away from what is drawn.
  const decorations = createMemo(() => {
    const name = typeof raw().name === 'string' ? (raw().name as string) : ''
    const owner = userId()
    if (!owner || raw().spawning === true) return []

    const items = roomDecorationItems().filter(i => i.decoration.type === 'creep' && i.user === owner)
    const definitions = new Map(items.map(i => [i._id, i.decoration]))
    return parseRoomDecorations(items).creeps
      .filter(d => creepMatchesDecoration(d, name))
      .map(d => definitions.get(d.id))
      .filter(d => d != null)
  })

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

      <Show when={decorations().length > 0}>
        <div style={{ background: '#21262d', 'border-top': '1px solid #30363d' }}>
          <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600, 'font-size': '10px' }}>
            Decorations ({decorations().length})
          </div>
          <div style={{ padding: '6px 8px', background: '#0d1117', display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
            <For each={decorations()}>
              {(decoration) => (
                <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
                  <Show when={decoration.preview?.['128x128'] ?? decoration.preview?.original}>
                    {(src) => (
                      <img src={src()} alt="" style={{
                        width: '24px', height: '24px', 'border-radius': '4px', 'flex-shrink': 0,
                        background: '#161b22', 'object-fit': 'cover',
                      }} />
                    )}
                  </Show>
                  <span style={{
                    'font-size': '11px', color: '#c9d1d9',
                    overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap',
                  }}>
                    {decoration.name ?? 'Creep decoration'}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
