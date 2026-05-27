import { createEffect, createSignal, onCleanup, onMount, For, Show } from 'solid-js'
import { Trash2, Pause, Play, X, Plus } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'
import { showLog, showConsole, showMemory, toggleShowLog, toggleShowConsole, toggleShowMemory, consoleInput, setConsoleInput, registerConsoleInput } from '~/stores/consoleStore.js'
import { watches, tempWatch, memoryValues, addWatch, removeWatch, clearTempWatch, initMemorySubscriptions } from '~/stores/memoryStore.js'
import { MemoryTree } from '~/components/MemoryTree.js'
import { currentShard } from '~/stores/roomDataStore.js'
import { createLogger } from '~/utils/log.js'
import { LS, getJson, setJson } from '~/utils/storage.js'

const { error } = createLogger('console')

interface ConsoleEntry {
  id: number
  log: string[]
  results: string[]
  error: string[]
}

function MemoryPane(props: { shard: string | null; width: number }) {
  const [addInput, setAddInput] = createSignal('')
  // Props shard may be null on private servers; fall back to the currently viewed room's shard
  const effectiveShard = () => props.shard ?? currentShard()

  onMount(() => {
    initMemorySubscriptions(effectiveShard())
  })

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

  return (
    <div style={{ width: `${props.width * 100}%`, 'flex-shrink': 0, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
      <div class="console-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px', ...monoStyle }}>

        {/* Temporary watch (creep) */}
        <Show when={tempWatch()}>
          {(tw) => {
            const creepPath = `creeps.${tw().name}`
            return (
              <div style={{ 'margin-bottom': '8px' }}>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'border-bottom': '1px solid #21262d', 'padding-bottom': '4px', 'margin-bottom': '4px' }}>
                  <span style={{ color: '#f0883e', 'font-weight': 600, flex: 1 }}>{creepPath}</span>
                  <span style={{ color: '#484f58', 'font-size': '10px', 'font-style': 'italic' }}>temp</span>
                  <button style={iconBtnStyle} title="Remove temp watch" onClick={clearTempWatch}>
                    <X size={12} />
                  </button>
                </div>
                <MemoryTree
                  value={memoryValues[creepPath]}
                  path={`Memory.${creepPath}`}
                  label={creepPath}
                  shard={effectiveShard()}
                />
              </div>
            )
          }}
        </Show>

        {/* Persistent watchlist */}
        <For each={watches()}>
          {(path) => (
            <div style={{ 'margin-bottom': '8px' }}>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'border-bottom': '1px solid #21262d', 'padding-bottom': '4px', 'margin-bottom': '4px' }}>
                <span style={{ color: '#c9d1d9', 'font-weight': 600, flex: 1 }}>{path}</span>
                <button style={iconBtnStyle} title="Remove watch" onClick={() => removeWatch(path)}>
                  <X size={12} />
                </button>
              </div>
              <MemoryTree
                value={memoryValues[path]}
                path={`Memory.${path}`}
                label={path}
                shard={effectiveShard()}
              />
            </div>
          )}
        </For>

        <Show when={watches().length === 0 && !tempWatch()}>
          <div style={{ color: '#484f58', 'font-style': 'italic' }}>No paths watched — add one below.</div>
        </Show>
      </div>

      {/* Add watch input */}
      <form
        onSubmit={(e) => { e.preventDefault(); addWatch(addInput()); setAddInput('') }}
        style={{ display: 'flex', gap: '6px', padding: '8px', 'border-top': '1px solid #30363d' }}
      >
        <input
          type="text"
          value={addInput()}
          onInput={(e) => setAddInput(e.currentTarget.value)}
          placeholder="creeps.Harvester1.energy"
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
            padding: '6px 8px',
            'border-radius': '4px',
            border: 'none',
            background: '#238636',
            color: '#fff',
            'font-size': '12px',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            gap: '4px',
          }}
          title="Add watch"
        >
          <Plus size={14} /> Watch
        </button>
      </form>
    </div>
  )
}

export function ConsolePanel(props: { shard?: string | null; isCollapsed?: boolean; onToggle?: () => void }) {
  const [entries, setEntries] = createSignal<ConsoleEntry[]>([])
  const [autoScroll, setAutoScroll] = createSignal(true)
  const DEFAULT_WEIGHTS = [1, 1, 1] as const
  const [weights, setWeights] = createSignal<number[]>(getJson(LS.consoleWeights, [...DEFAULT_WEIGHTS]))
  const [dragging, setDragging] = createSignal<number | null>(null)
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

  const syncCollapse = (nextShowLog: boolean, nextShowConsole: boolean, nextShowMemory: boolean) => {
    const allOff = !nextShowLog && !nextShowConsole && !nextShowMemory
    if (allOff && !props.isCollapsed) props.onToggle?.()
    if (!allOff && props.isCollapsed) props.onToggle?.()
  }

  createEffect(() => {
    syncCollapse(showLog(), showConsole(), showMemory())
  })

  // Weight-based split: returns visible pane widths as fractions
  const paneWidths = () => {
    const w = weights()
    const visible = [showLog(), showConsole(), showMemory()] as const
    const visibleCount = visible.filter(Boolean).length
    if (visibleCount === 0) return [0, 0, 0]
    if (visibleCount === 1) {
      const idx = visible.findIndex(Boolean)
      return [0, 0, 0].map((_, i) => (i === idx ? 1 : 0))
    }
    const visibleWeights = visible.map((v, i) => (v ? w[i] : 0))
    const totalWeight = visibleWeights.reduce((a, b) => a + b, 0)
    if (totalWeight === 0) {
      const equal = 1 / visibleCount
      return [0, 0, 0].map((_, i) => (visible[i] ? equal : 0))
    }
    return visible.map((v, i) => (v ? w[i] / totalWeight : 0))
  }

  // Persist weights on change
  createEffect(() => {
    setJson(LS.consoleWeights, weights())
  })

  // --- Drag handlers for 2 handles (0 = between Log/Console, 1 = between Console/Memory) ---
  const handlePointerDown = (handleIndex: 0 | 1) => (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(handleIndex)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  const handlePointerMove = (e: PointerEvent) => {
    const dragHandle = dragging()
    if (dragHandle === null) return

    const container = splitContainerRef
    if (!container) return

    const rect = container.getBoundingClientRect()
    const relX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width))

    const w = [...weights()]
    const visible = [showLog(), showConsole(), showMemory()] as const

      if (dragHandle === 0) {
      // Handle between Log and Console: mouse position = right edge of Log
      const logVisible = visible[0]
      const consoleVisible = visible[1]
      if (!logVisible || !consoleVisible) return

      const logWeight = relX / (1 - relX)
      w[0] = logWeight
      w[1] = 1
      setWeights(w)
    } else {
      // Handle between Console and Memory: mouse position = right edge of Console
      const consoleVisible = visible[1]
      const memoryVisible = visible[2]
      if (!consoleVisible || !memoryVisible) return

      const consoleWeight = relX / (1 - relX)
      w[1] = consoleWeight
      w[2] = 1
      setWeights(w)
    }
  }

  const handlePointerUp = () => {
    setDragging(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', handlePointerMove)
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const c = client()
    if (!c || !consoleInput().trim()) return
    try {
      await c.http.user.console(consoleInput().trim(), props.shard ?? 'shard0')
      setConsoleInput('')
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
        <button onClick={toggleShowMemory} style={toggleBtnStyle(showMemory())}>Memory</button>
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
        <div ref={(el) => splitContainerRef = el} style={{ flex: 1, display: 'flex', overflow: 'hidden', 'user-select': dragging() !== null ? 'none' : 'auto' }}>

          {/* Log pane */}
          <Show when={showLog()}>
            <div
              style={{
                width: `${paneWidths()[0] * 100}%`,
                'flex-shrink': 0,
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

          {/* Drag handle 0 – between Log and Console */}
          <Show when={showLog() && showConsole()}>
            <div
              onPointerDown={handlePointerDown(0)}
              style={{
                width: '4px',
                'flex-shrink': 0,
                cursor: 'col-resize',
                background: dragging() === 0 ? '#388bfd' : '#21262d',
              }}
            />
          </Show>

          {/* Console pane */}
          <Show when={showConsole()}>
            <div style={{ width: `${paneWidths()[1] * 100}%`, 'flex-shrink': 0, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
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
                  ref={(el) => registerConsoleInput(el)}
                  value={consoleInput()}
                  onInput={(e) => setConsoleInput(e.currentTarget.value)}
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

          {/* Drag handle 1 – between Console and Memory */}
          <Show when={showConsole() && showMemory()}>
            <div
              onPointerDown={handlePointerDown(1)}
              style={{
                width: '4px',
                'flex-shrink': 0,
                cursor: 'col-resize',
                background: dragging() === 1 ? '#388bfd' : '#21262d',
              }}
            />
          </Show>

          {/* Memory pane */}
          <Show when={showMemory()}>
            <MemoryPane shard={props.shard ?? null} width={paneWidths()[2]} />
          </Show>

        </div>
      </Show>
    </div>
  )
}
