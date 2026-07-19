import { Show } from 'solid-js'
import { gameTime } from '~/stores/clientStore.js'
import { roomUsers } from '~/stores/roomDataStore.js'
import { UserLink } from '~/components/UserLink.js'
import { HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { StoreDetails } from './StoreDetails.js'
import { kvCell, kvGrid } from './shared.js'

export function RuinDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const decayCountdown = () => {
    const dt = raw().decayTime
    if (typeof dt !== 'number') return null
    const gt = gameTime()
    return gt !== null ? Math.max(0, dt - gt) : dt
  }

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

  const structure = () => raw().structure as Record<string, unknown> | undefined
  const structureType = () => typeof structure()?.type === 'string' ? (structure()!.type as string) : null
  const structureHits = () => typeof structure()?.hits === 'number' ? (structure()!.hits as number) : null
  const structureHitsMax = () => typeof structure()?.hitsMax === 'number' ? (structure()!.hitsMax as number) : null
  const structureLevel = () => typeof structure()?.level === 'number' ? (structure()!.level as number) : null
  const structureEnergy = () => typeof structure()?.energy === 'number' ? (structure()!.energy as number) : null
  const structureEnergyCapacity = () => typeof structure()?.energyCapacity === 'number' ? (structure()!.energyCapacity as number) : null

  const store = () => raw().store as Record<string, number> | undefined
  const storeCapacity = () => typeof raw().storeCapacity === 'number' ? (raw().storeCapacity as number) : null

  return (
    <div>
      <div style={kvGrid}>
        <Show when={decayCountdown() !== null}>
          <>
            <div style={kvCell(true)}>Decay in</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{decayCountdown()}</div>
          </>
        </Show>
        <Show when={ownerName()}>
          <>
            <div style={kvCell(true)}>Owner</div>
            <div style={kvCell()}><UserLink username={ownerUsername()} fallback={ownerName()} /></div>
          </>
        </Show>
      </div>

      <Show when={structureType()}>
        <div style={{ background: '#21262d', 'border-top': '1px solid #30363d', 'font-size': '10px' }}>
          <div style={{ padding: '4px 8px', background: '#161b22', color: '#8b949e', 'font-weight': 600 }}>
            Was: {structureType()}
          </div>
          <div style={kvGrid}>
            <Show when={structureHitsMax() !== null}>
              <>
                <div style={kvCell(true)}>Hits</div>
                <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
                  {structureHits() ?? 0} / {structureHitsMax()}
                </div>
              </>
            </Show>
            <Show when={structureLevel() !== null}>
              <>
                <div style={kvCell(true)}>Level</div>
                <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{structureLevel()}</div>
              </>
            </Show>
            <Show when={structureEnergyCapacity() !== null}>
              <>
                <div style={kvCell(true)}>Energy cap</div>
                <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
                  {structureEnergy() ?? 0} / {structureEnergyCapacity()}
                </div>
              </>
            </Show>
          </div>
          <HitsBar hits={structureHits()} max={structureHitsMax()} />
        </div>
      </Show>

      <StoreDetails store={store()} capacity={storeCapacity()} />
    </div>
  )
}
