import { Show } from 'solid-js'
import { Bell, BellOff } from 'lucide-solid'
import { client, gameTime, userInfo } from '~/stores/clientStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { createLogger } from '~/utils/log.js'
import { HitsBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { kvCell, kvGrid } from './shared.js'

const { error } = createLogger('SelectionList')

export function ExtensionDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const energy = () => {
    const store = raw().store as Record<string, number> | undefined
    return store?.energy ?? 0
  }
  const energyCapacity = () => {
    const cap = raw().storeCapacityResource as Record<string, number> | undefined
    return cap?.energy ?? 0
  }
  const hits = () => typeof raw().hits === 'number' ? (raw().hits as number) : null
  const hitsMax = () => typeof raw().hitsMax === 'number' ? (raw().hitsMax as number) : null
  // Links carry a relative `cooldown`; labs report an absolute `cooldownTime` (vanilla), so
  // derive the remaining ticks from the current game time. The row only shows when present.
  const cooldown = () => {
    if (typeof raw().cooldown === 'number') return raw().cooldown as number
    const ct = raw().cooldownTime
    const gt = gameTime()
    if (typeof ct === 'number' && gt !== null) return Math.max(0, ct - gt)
    return null
  }
  const notifyWhenAttacked = () => raw().notifyWhenAttacked === true
  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null
  const isMyStructure = () => userId() !== null && userId() === userInfo()?._id

  const handleToggleNotify = () => {
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, raw().room as string, 'notifyWhenAttacked', { enabled: !notifyWhenAttacked() })
      .catch((err: Error) => error('notifyWhenAttacked failed:', err))
  }

  return (
    <div>
    <div style={kvGrid}>
      <div style={kvCell(true)}>Energy</div>
      <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
        {energy()} / {energyCapacity()}
      </div>

      <Show when={hits() !== null && hitsMax() !== null}>
        <>
          <div style={kvCell(true)}>Hits</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{hits()} / {hitsMax()}</div>
        </>
      </Show>

      <Show when={cooldown() !== null}>
        <>
          <div style={kvCell(true)}>Cooldown</div>
          <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{cooldown()}</div>
        </>
      </Show>

      <Show when={isMyStructure() && !historyMode()}>
        <>
          <div style={kvCell(true)}>Notify when attacked</div>
          <div style={{ ...kvCell(), display: 'flex', 'align-items': 'center' }}>
            <button
              onClick={handleToggleNotify}
              title={notifyWhenAttacked() ? 'Notifications on — click to disable' : 'Notifications off — click to enable'}
              style={{
                background: 'transparent',
                border: 'none',
                color: notifyWhenAttacked() ? '#3fb950' : '#484f58',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                'align-items': 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = notifyWhenAttacked() ? '#56d364' : '#8b949e' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = notifyWhenAttacked() ? '#3fb950' : '#484f58' }}
            >
              {notifyWhenAttacked() ? <Bell size={12} /> : <BellOff size={12} />}
            </button>
          </div>
        </>
      </Show>
    </div>
      <HitsBar hits={hits()} max={hitsMax()} />
    </div>
  )
}
