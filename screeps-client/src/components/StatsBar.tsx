import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { client, userInfo } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { CpuStats } from 'screeps-connectivity'

interface StatsBarProps {
  mapZoom?: number | null
  mapSubsActive?: boolean | null
}

export function StatsBar(props: StatsBarProps) {
  const [cpu, setCpu] = createSignal<CpuStats | null>(null)

  onMount(() => {
    const c = client()
    if (!c) return

    const group = new SubscriptionGroup()
    group.add(c.stores.user.subscribe('cpu'))
    group.add(c.stores.user.on('user:cpu', (data) => {
      setCpu(data)
    }))

    onCleanup(() => {
      group.dispose()
    })
  })

  const cpuPercent = () => {
    const stats = cpu()
    if (!stats) return '—'
    const limit = userInfo()?.cpu ?? '?'
    return `${stats.cpu.toFixed(0)} / ${limit}`
  }

  const memoryText = () => {
    const stats = cpu()
    if (!stats) return '—'
    return `${(stats.memory / 1024).toFixed(1)} KB`
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        padding: '6px 16px',
        'font-size': '12px',
        color: '#8b949e',
        'align-items': 'center',
      }}
    >
      <Show when={cpu() !== null}>
        <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          <span style={{ 'font-weight': 600 }}>CPU:</span>
          <span style={{ color: '#c9d1d9' }}>{cpuPercent()}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          <span style={{ 'font-weight': 600 }}>Memory:</span>
          <span style={{ color: '#c9d1d9' }}>{memoryText()}</span>
        </div>
      </Show>
      <Show when={props.mapZoom !== null && props.mapZoom !== undefined}>
        <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          <span style={{ 'font-weight': 600 }}>Zoom:</span>
          <span style={{ color: '#c9d1d9' }}>{(props.mapZoom! * 100).toFixed(0)}%</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          <span style={{ 'font-weight': 600 }}>Subs:</span>
          <span style={{ color: props.mapSubsActive === false ? '#e3b341' : '#3fb950' }}>
            {props.mapSubsActive === false ? 'paused' : 'active'}
          </span>
        </div>
      </Show>
    </div>
  )
}
