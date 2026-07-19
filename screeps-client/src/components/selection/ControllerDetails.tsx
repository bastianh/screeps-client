import { Show, createSignal } from 'solid-js'
import { client, gameTime, userInfo } from '~/stores/clientStore.js'
import { roomOwner, roomUsers, currentShard, currentRoom } from '~/stores/roomDataStore.js'
import { historyMode } from '~/stores/historyStore.js'
import { CONTROLLER_DOWNGRADE, CONTROLLER_LEVEL_TOTAL } from '~/utils/gameConstants.js'
import { createLogger } from '~/utils/log.js'
import { formatLargeNumber } from '~/utils/formatNumber.js'
import { UserLink } from '~/components/UserLink.js'
import { MeterBar } from '~/components/MeterBar.js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { kvCell, kvGrid } from './shared.js'

const { error } = createLogger('SelectionList')

export function ControllerDetails(props: { item: SelectedObject }) {
  const raw = () => props.item.raw as Record<string, unknown>

  const level = () => typeof raw().level === 'number' ? (raw().level as number) : 0
  const progress = () => typeof raw().progress === 'number' ? (raw().progress as number) : null
  const progressTotal = () => {
    if (typeof raw().progressTotal === 'number') return raw().progressTotal as number
    return CONTROLLER_LEVEL_TOTAL[level()] ?? null
  }
  const downgradeTime = () => typeof raw().downgradeTime === 'number' ? (raw().downgradeTime as number) : null
  const safeModeAvailable = () => typeof raw().safeModeAvailable === 'number' ? (raw().safeModeAvailable as number) : 0
  const safeMode = () => typeof raw().safeMode === 'number' ? (raw().safeMode as number) : null
  const isPowerEnabled = () => raw().isPowerEnabled === true
  const reservation = () => raw().reservation as { user: string; endTime: number } | undefined
  const userId = () => typeof raw().user === 'string' ? (raw().user as string) : null

  const ownerName = () => {
    const uid = userId()
    if (!uid) return null
    return roomOwner()?.username ?? uid
  }


  const ticksRemaining = () => {
    const dt = downgradeTime()
    const gt = gameTime()
    if (dt !== null && gt !== null) return Math.max(0, dt - gt)
    return null
  }

  const downgradeLabel = () => {
    const ticks = ticksRemaining()
    if (ticks === null) return '—'
    const max = CONTROLLER_DOWNGRADE[level()]
    if (max !== undefined && ticks >= max) return 'Max'
    return String(ticks)
  }

  const isMyRoom = () => userId() !== null && userId() === userInfo()?._id

  const [unclaimConfirming, setUnclaimConfirming] = createSignal(false)
  let unclaimTimeout: ReturnType<typeof setTimeout> | null = null

  const handleActivateSafeMode = () => {
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, currentRoom() ?? (raw().room as string) ?? '', 'activateSafeMode', { id: props.item.id }, currentShard())
      .catch((err: Error) => error('activateSafeMode failed:', err))
  }

  const handleUnclaim = () => {
    if (!unclaimConfirming()) {
      setUnclaimConfirming(true)
      unclaimTimeout = setTimeout(() => setUnclaimConfirming(false), 3000)
      return
    }
    if (unclaimTimeout) { clearTimeout(unclaimTimeout); unclaimTimeout = null }
    setUnclaimConfirming(false)
    const c = client()
    if (!c) return
    c.http.game.addObjectIntent(props.item.id, currentRoom() ?? (raw().room as string) ?? '', 'unclaim', { id: props.item.id }, currentShard())
      .catch((err: Error) => error('unclaim failed:', err))
  }

  return (
    <div>
      <div style={kvGrid}>
        <div style={kvCell(true)}>Owner</div>
        <div style={kvCell()}><UserLink username={roomOwner()?.username} fallback={ownerName() ?? 'None'} /></div>

        <Show when={reservation()}>
          <>
            <div style={kvCell(true)}>Reserved by</div>
            <div style={kvCell()}>
              <UserLink
                username={roomUsers()?.[reservation()!.user]?.username}
                fallback={reservation()!.user}
              />
            </div>
            <div style={kvCell(true)}>Reservation</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>
              {gameTime() !== null ? Math.max(0, reservation()!.endTime - gameTime()!) : reservation()!.endTime} ticks
            </div>
          </>
        </Show>

        <Show when={level() > 0}>
          <>
            <div style={kvCell(true)}>Level</div>
            <div style={kvCell()}>{level()}</div>

            <div style={kvCell(true)}>Safe modes</div>
            <div style={kvCell()}>{safeModeAvailable()}</div>

            <div style={kvCell(true)}>Power</div>
            <div style={kvCell()}>{isPowerEnabled() ? 'Enabled' : 'Disabled'}</div>

            <div style={kvCell(true)}>Downgrade in</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums', color: downgradeLabel() === 'Max' ? '#3fb950' : undefined }}>{downgradeLabel()}</div>
          </>
        </Show>

        <Show when={safeMode() !== null}>
          <>
            <div style={kvCell(true)}>Safe mode active</div>
            <div style={{ ...kvCell(), 'font-variant-numeric': 'tabular-nums' }}>{safeMode()} ticks</div>
          </>
        </Show>
      </div>

      <Show when={level() > 0 && level() < 8 && progress() !== null && progressTotal() !== null}>
        <MeterBar label={`RCL ${level()} → ${level() + 1}`} value={progress()!} max={progressTotal()!} color="#58a6ff" format={formatLargeNumber} />
      </Show>

      <Show when={isMyRoom() && !historyMode()}>
        <div style={{ padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '6px', background: '#0d1117' }}>
          <button
            onClick={handleActivateSafeMode}
            disabled={safeModeAvailable() === 0}
            style={{
              background: safeModeAvailable() > 0 ? '#1f6feb' : '#161b22',
              color: '#fff',
              border: 'none',
              'border-radius': '4px',
              padding: '6px 8px',
              'font-size': '12px',
              cursor: safeModeAvailable() > 0 ? 'pointer' : 'not-allowed',
              opacity: safeModeAvailable() > 0 ? 1 : 0.5,
            }}
            onMouseEnter={(e) => { if (safeModeAvailable() > 0) e.currentTarget.style.background = '#388bfd' }}
            onMouseLeave={(e) => { if (safeModeAvailable() > 0) e.currentTarget.style.background = '#1f6feb' }}
          >
            Activate safe mode
          </button>
          <button
            onClick={handleUnclaim}
            style={{
              background: unclaimConfirming() ? '#da3633' : '#f85149',
              color: '#fff',
              border: 'none',
              'border-radius': '4px',
              padding: '6px 8px',
              'font-size': '12px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!unclaimConfirming()) e.currentTarget.style.background = '#da3633' }}
            onMouseLeave={(e) => { if (!unclaimConfirming()) e.currentTarget.style.background = '#f85149' }}
          >
            {unclaimConfirming() ? 'Confirm unclaim' : 'Unclaim'}
          </button>
        </div>
      </Show>
    </div>
  )
}
