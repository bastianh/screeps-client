import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'

interface ConsoleEntry {
  id: number
  log: string[]
  results: string[]
}

export function ConsolePanel(props: { shard?: string; isCollapsed?: boolean; onToggle?: () => void }) {
  const [entries, setEntries] = createSignal<ConsoleEntry[]>([])
  const [input, setInput] = createSignal('')
  const [autoScroll, setAutoScroll] = createSignal(true)
  const [activeTab, setActiveTab] = createSignal<'log' | 'console'>('log')
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

  const tabButtonStyle = (tab: 'log' | 'console') => ({
    background: activeTab() === tab ? '#30363d' : 'transparent',
    border: 'none',
    color: activeTab() === tab ? '#c9d1d9' : '#8b949e',
    'font-size': '12px',
    cursor: 'pointer',
    padding: '4px 10px',
    'border-radius': '4px',
  } as const)

  const handleBarClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) {
      props.onToggle?.()
    }
  }

  const stopPropagation = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const logLines = () => entries().flatMap((e) => e.log)
  const resultLines = () => entries().flatMap((e) => e.results)

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        height: '100%',
        background: '#0d1117',
      }}
    >
      {/* Tab bar - always visible */}
      <div
        onClick={handleBarClick}
        style={{
          height: '32px',
          'flex-shrink': 0,
          padding: '0 10px',
          'border-bottom': '1px solid #30363d',
          display: 'flex',
          'align-items': 'center',
          gap: '4px',
          cursor: 'pointer',
        }}
      >
        <button onClick={(e) => { stopPropagation(e); setActiveTab('log') }} style={tabButtonStyle('log')}>
          Log
        </button>
        <button onClick={(e) => { stopPropagation(e); setActiveTab('console') }} style={tabButtonStyle('console')}>
          Console
        </button>

        <div style={{ 'margin-left': 'auto', display: 'flex', gap: '8px', 'align-items': 'center' }}>
          <button
            onClick={(e) => { stopPropagation(e); setEntries([]) }}
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
          {props.onToggle && (
            <button
              onClick={(e) => { stopPropagation(e); props.onToggle?.() }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                'font-size': '11px',
                cursor: 'pointer',
              }}
            >
              {props.isCollapsed ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}>
        {activeTab() === 'log' ? (
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
            {logLines().length === 0 && (
              <div style={{ color: '#484f58', 'font-style': 'italic' }}>No console output yet…</div>
            )}
            {entries().map((entry) =>
              entry.log.map((line) => (
                <div style={{ 'margin-bottom': '4px' }}>
                  <div
                    style={{
                      color: '#c9d1d9',
                      'white-space': 'pre-wrap',
                      'word-break': 'break-word',
                    }}
                    innerHTML={line}
                  />
                </div>
              )),
            )}
          </div>
        ) : (
          <>
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
              {resultLines().length === 0 && (
                <div style={{ color: '#484f58', 'font-style': 'italic' }}>No command results yet…</div>
              )}
              {entries().map((entry) =>
                entry.results.map((line) => (
                  <div style={{ 'margin-bottom': '4px' }}>
                    <div
                      style={{
                        color: '#58a6ff',
                        'white-space': 'pre-wrap',
                        'word-break': 'break-word',
                      }}
                      innerHTML={line}
                    />
                  </div>
                )),
              )}
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
          </>
        )}
      </div>
    </div>
  )
}
