import { createSignal, onMount, Switch, Match, Show } from 'solid-js'
import { ChevronLeft } from 'lucide-solid'
import type { ApiPowerCreep } from 'screeps-connectivity'
import { client, userInfo } from '~/stores/clientStore.js'
import { goToUser, powerView, powerCreepId } from '~/stores/routeStore.js'
import { gplLevel } from '~/utils/levels.js'
import { freePowerLevels } from '~/data/powerCreeps.js'
import { PowerCreepList } from './PowerCreepList.js'
import { PowerCreepCreate } from './PowerCreepCreate.js'
import { PowerCreepDetail } from './PowerCreepDetail.js'
import { BG, PANEL, BORDER, TEXT, MUTED, GPL_TEXT } from './theme.js'

// Shared data + page frame for the Power Creeps section. Owns the creep list
// (fetched once, shared with all sub-views) and the derived free-power-level
// budget, and routes between list / create / per-creep editor.
export interface PowerContext {
  creeps: () => ApiPowerCreep[]
  free: () => number
  gpl: () => number
  reload: () => Promise<void>
}

// Optional navigation overrides — when provided, sub-components use these
// instead of the global routeStore functions, enabling embedding in Overview.
export interface PowerNav {
  goToList: () => void
  goToNew: () => void
  goToCreep: (id: string) => void
}

export function PowerCreeps() {
  const [creeps, setCreeps] = createSignal<ApiPowerCreep[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const reload = async () => {
    const c = client()
    if (!c) return
    try {
      const res = await c.http.game.powerCreeps.list()
      setCreeps(res.list ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void reload()
    // Refresh the account record so GPL (and the free-level budget) is current.
    void client()?.stores.user.refreshMe().catch(() => {})
  })

  const gpl = () => gplLevel(userInfo()?.power ?? 0)
  const free = () => freePowerLevels(userInfo()?.power, creeps())
  const ctx: PowerContext = { creeps, free, gpl, reload }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: BG, color: TEXT }}>
      <div style={{ 'max-width': '960px', margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '0 0 14px', 'border-bottom': `1px solid ${BORDER}`, 'margin-bottom': '24px' }}>
          <button
            onClick={goToUser}
            title="Back to Overview"
            style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '7px 12px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#21262d', color: TEXT, cursor: 'pointer' }}
          >
            <ChevronLeft size={16} /> Overview
          </button>
          <h1 style={{ margin: 0, 'font-size': '22px', 'font-weight': 600, color: TEXT }}>Power Creeps</h1>
          <div style={{ flex: 1 }} />
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '6px', padding: '6px 12px', 'font-size': '13px', color: MUTED }}>
            Global Power Level <strong style={{ color: GPL_TEXT, 'margin-left': '4px' }}>{gpl()}</strong>
            <span style={{ margin: '0 6px', color: BORDER }}>·</span>
            <strong style={{ color: free() > 0 ? GPL_TEXT : MUTED }}>{Math.max(0, free())}</strong> free
          </div>
        </div>

        <Show when={error()}>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
            Couldn't load power creeps — this server may not support them.
          </div>
        </Show>

        <Show when={!error()}>
          <Switch>
            <Match when={powerView() === 'new'}>
              <PowerCreepCreate ctx={ctx} />
            </Match>
            <Match when={powerView() === 'detail'}>
              <PowerCreepDetail ctx={ctx} id={powerCreepId()} />
            </Match>
            <Match when={powerView() === 'list'}>
              <PowerCreepList ctx={ctx} loading={loading()} />
            </Match>
          </Switch>
        </Show>
      </div>
    </div>
  )
}
