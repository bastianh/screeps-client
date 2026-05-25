import { createEffect, createSignal, onCleanup, onMount, For, Show } from 'solid-js'
import { Trash2, Pause, Play } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'
import { showLog, showConsole, toggleShowLog, toggleShowConsole } from '~/stores/consoleStore.js'
import { createLogger } from '~/utils/log.js'
import { LS, getNum, setNum } from '~/utils/storage.js'

const { error } = createLogger('console')

interface ConsoleEntry {
  id: number
  log: string[]
  results: string[]
  error: string[]
}

export function ConsolePanel(props: { shard?: string | null; isCollapsed?: boolean; onToggle?: () => void }) {
  const [entries, setEntries] = createSignal<ConsoleEntry[]>([])
  const [input, setInput] = createSignal('')
  const [autoScroll, setAutoScroll] = createSignal(true)
  const [splitPercent, setSplitPercent] = createSignal(getNum(LS.consoleSplit, 50))
  const [splitDragging, setSplitDragging] = createSignal(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unassigned-vars
  let logScrollRef: HTMLDivElement | any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unassigned-vars
  let consoleScrollRef: HTMLDivElement | any
  let splitContainerRef: HTMLDivElement | undefined = undefined
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
        error: msg.error ?? [],
      }
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    }))
    onCleanup(() => group.dispose())
  })

  createEffect(() => {
    entries()
    if (!autoScroll()) return
    requestAnimationFrame(() => {
      if (showLog() && logScrollRef) logScrollRef.scrollTop = logScrollRef.scrollHeight
      if (showConsole() && consoleScrollRef) consoleScrollRef.scrollTop = consoleScrollRef.scrollHeight
    })
  })

  const syncCollapse = (nextShowLog: boolean, nextShowConsole: boolean) => {
    const bothOff = !nextShowLog && !nextShowConsole
    if (bothOff && !props.isCollapsed) props.onToggle?.()
    if (!bothOff && props.isCollapsed) props.onToggle?.()
  }

  createEffect(() => {
    syncCollapse(showLog(), showConsole())
  })

  const startSplitDrag = (e: PointerEvent) => {
    e.preventDefault()
    setSplitDragging(true)
    const container = splitContainerRef!
    const rect = container.getBoundingClientRect()

    const onMove = (ev: PointerEvent) => {
      const percent = ((ev.clientX - rect.left) / rect.width) * 100
      const clamped = Math.max(15, Math.min(85, percent))
      setSplitPercent(clamped)
      setNum(LS.consoleSplit, clamped)
    }
    const onUp = () => {
      setSplitDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const c = client()
    if (!c || !input().trim()) return
    try {
      await c.http.user.console(input().trim(), props.shard ?? 'shard0')
      setInput('')
    } catch (err) {
      error('command failed:', err)
    }
  }

  const toggleBtnStyle = (active: boolean) => ({
    background: active ? '#30363d' : 'transparent',
    border: `1px solid ${active ? '#58a6ff' : 'transparent'}`,
    color: active ? '#c9d1d9' : '#8b949e',
    'font-size': '12px',
    cursor: 'pointer',
    padding: '2px 10px',
    'border-radius': '4px',
  } as const)

  const logLines = () => entries().flatMap((e) => e.log)
  const errorLines = () => entries().flatMap((e) => e.error)
  const resultLines = () => entries().flatMap((e) => e.results)

  const monoStyle = {
    'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'font-size': '12px',
    'line-height': '1.5',
  } as const

  const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    padding: '4px',
    'border-radius': '4px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
  } as const

  const resumeAutoScroll = () => {
    setAutoScroll(true)
    requestAnimationFrame(() => {
      if (showLog() && logScrollRef) logScrollRef.scrollTop = logScrollRef.scrollHeight
      if (showConsole() && consoleScrollRef) consoleScrollRef.scrollTop = consoleScrollRef.scrollHeight
    })
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%', background: '#0d1117' }}>
      {/* Bar – always 32px */}
      <div
        style={{
          height: '32px',
          'flex-shrink': 0,
          padding: '0 10px',
          'border-bottom': '1px solid #30363d',
          display: 'flex',
          'align-items': 'center',
          gap: '6px',
        }}
      >
        <button onClick={toggleShowLog} style={toggleBtnStyle(showLog())}>Log</button>
        <button onClick={toggleShowConsole} style={toggleBtnStyle(showConsole())}>Console</button>
      </div>

      <style>{`
        .console-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .console-scroll::-webkit-scrollbar-track {
          background: #161b22;
        }
        .console-scroll::-webkit-scrollbar-thumb {
          background: #484f58;
          border-radius: 4px;
        }
        .console-scroll::-webkit-scrollbar-thumb:hover {
          background: #6e7681;
        }
      `}</style>

      {/* Split content – hidden when collapsed */}
      <Show when={!props.isCollapsed}>
        <div ref={(el) => splitContainerRef = el} style={{ flex: 1, display: 'flex', overflow: 'hidden', 'user-select': splitDragging() ? 'none' : 'auto' }}>

          {/* Log pane */}
          <Show when={showLog()}>
            <div
              style={{
                ...(showConsole() ? { width: `${splitPercent()}%`, 'flex-shrink': 0 } : { flex: 1 }),
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              {/* Sidebar – only when log is visible */}
              <div style={{
                width: '32px',
                'flex-shrink': 0,
                'border-right': '1px solid #30363d',
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                padding: '6px 0',
                gap: '6px',
              }}>
                <button
                  onClick={() => autoScroll() ? setAutoScroll(false) : resumeAutoScroll()}
                  title={autoScroll() ? 'Pause scrolling' : 'Resume scrolling'}
                  style={iconBtnStyle}
                >
                  {autoScroll() ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => setEntries([])}
                  title="Clear"
                  style={iconBtnStyle}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div
                ref={logScrollRef}
                class="console-scroll"
                onScroll={() => {
                  if (!logScrollRef) return
                  setAutoScroll(logScrollRef.scrollHeight - logScrollRef.scrollTop - logScrollRef.clientHeight < 20)
                }}
                style={{ flex: 1, overflow: 'auto', padding: '8px', ...monoStyle }}
              >
                {logLines().length === 0 && errorLines().length === 0 && (
                  <div style={{ color: '#484f58', 'font-style': 'italic' }}>No log output yet…</div>
                )}
                <For each={errorLines()}>
                  {(line) => (
                    <div style={{ 'margin-bottom': '4px', color: '#f85149', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}
                      /* eslint-disable-next-line solid/no-innerhtml */
                      innerHTML={line}
                    />
                  )}
                </For>
                <For each={logLines()}>
                  {(line) => (
                    <div style={{ 'margin-bottom': '4px', color: '#c9d1d9', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}
                      /* eslint-disable-next-line solid/no-innerhtml */
                      innerHTML={line}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>

            {/* Drag handle – only between both panes */}
            <Show when={showLog() && showConsole()}>
              <div
                onPointerDown={startSplitDrag}
                style={{
                  width: '4px',
                  'flex-shrink': 0,
                  cursor: 'col-resize',
                  background: splitDragging() ? '#388bfd' : '#21262d',
                }}
              />
            </Show>

            {/* Console pane */}
            <Show when={showConsole()}>
              <div style={{ flex: 1, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
                <div
                  ref={consoleScrollRef}
                  class="console-scroll"
                  onScroll={() => {
                    if (!consoleScrollRef) return
                    setAutoScroll(consoleScrollRef.scrollHeight - consoleScrollRef.scrollTop - consoleScrollRef.clientHeight < 20)
                  }}
                  style={{ flex: 1, overflow: 'auto', padding: '8px', ...monoStyle }}
                >
                  {resultLines().length === 0 && (
                    <div style={{ color: '#484f58', 'font-style': 'italic' }}>No command results yet…</div>
                  )}
                  <For each={resultLines()}>
                    {(line) => (
                      <div style={{ 'margin-bottom': '4px', color: '#58a6ff', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}
                        /* eslint-disable-next-line solid/no-innerhtml */
                        innerHTML={line}
                      />
                    )}
                  </For>
                </div>
                <form
                  onSubmit={handleSubmit}
                  style={{ display: 'flex', gap: '6px', padding: '8px', 'border-top': '1px solid #30363d' }}
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
            </Show>

          </div>
      </Show>
    </div>
  )
}
