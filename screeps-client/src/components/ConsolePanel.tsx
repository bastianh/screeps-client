import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'

interface ConsoleEntry {
  id: number
  log: string[]
  results: string[]
}

export function ConsolePanel(props: { shard?: string }) {
  const [entries, setEntries] = createSignal<ConsoleEntry[]>([])
  const [input, setInput] = createSignal('')
  const [autoScroll, setAutoScroll] = createSignal(true)
  let scrollRef: HTMLDivElement | undefined
  let nextId = 0

  onMount(() => {
    const c = client()
    if (!c) return

    const group = new SubscriptionGroup()

    group.add(c.stores.user.subscribe('console'))

    group.add(c.stores.user.on('user:console', (data) => {
      const msg = data.messages as ConsoleMessage
      const entry: ConsoleEntry = {
        id: nextId++,
        log: msg.log ?? [],
        results: msg.results ?? [],
      }
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    }))

    onCleanup(() => {
      group.dispose()
    })
  })

  // Auto-scroll
  createEffect(() => {
    entries() // depend on entries
    if (!autoScroll() || !scrollRef) return
    requestAnimationFrame(() => {
      scrollRef!.scrollTop = scrollRef!.scrollHeight
    })
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const c = client()
    if (!c || !input().trim()) return

    try {
      await c.http.user.console(input().trim(), props.shard ?? 'shard0')
      setInput('')
    } catch (err) {
      console.error('Console command failed:', err)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        height: '100%',
        border: '1px solid #30363d',
        'border-radius': '6px',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          'border-bottom': '1px solid #30363d',
          'font-size': '12px',
          'font-weight': 600,
          color: '#8b949e',
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
        }}
      >
        <span>Console</span>
        <button
          onClick={() => setEntries([])}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8b949e',
            'font-size': '11px',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          if (!scrollRef) return
          const nearBottom = scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight < 20
          setAutoScroll(nearBottom)
        }}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
          'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          'font-size': '12px',
          'line-height': '1.5',
        }}
      >
        {entries().length === 0 && (
          <div style={{ color: '#484f58', 'font-style': 'italic' }}>No console output yet…</div>
        )}
        {entries().map((entry) => (
          <div style={{ 'margin-bottom': '4px' }}>
            {entry.log.map((line) => (
              <div style={{ color: '#c9d1d9', 'white-space': 'pre-wrap', 'word-break': 'break-word' }} innerHTML={line} />
            ))}
            {entry.results.map((line) => (
              <div style={{ color: '#58a6ff', 'white-space': 'pre-wrap', 'word-break': 'break-word' }} innerHTML={line} />
            ))}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '6px',
          padding: '8px',
          'border-top': '1px solid #30363d',
        }}
      >
        <span style={{ color: '#8b949e', 'font-size': '13px', 'line-height': '28px' }}>&gt;</span>
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="Game.creeps.Harvester1.moveTo(10, 10)"
          style={{
            flex: 1,
            padding: '6px 8px',
            'border-radius': '4px',
            border: '1px solid #30363d',
            background: '#161b22',
            color: '#c9d1d9',
            'font-size': '12px',
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            'border-radius': '4px',
            border: 'none',
            background: '#238636',
            color: '#fff',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          Run
        </button>
      </form>
    </div>
  )
}
