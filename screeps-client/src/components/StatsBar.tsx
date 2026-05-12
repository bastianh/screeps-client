import { createSignal, onCleanup, onMount } from 'solid-js'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { CpuStats } from 'screeps-connectivity'

export function StatsBar() {
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
    return `${stats.cpu.toFixed(1)} / 20`
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
        'border-bottom': '1px solid #30363d',
        'font-size': '12px',
        color: '#8b949e',
        'align-items': 'center',
      }}
    >
      <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
        <span style={{ 'font-weight': 600 }}>CPU:</span>
        <span style={{ color: '#c9d1d9' }}>{cpuPercent()}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
        <span style={{ 'font-weight': 600 }}>Memory:</span>
        <span style={{ color: '#c9d1d9' }}>{memoryText()}</span>
      </div>
    </div>
  )
}
