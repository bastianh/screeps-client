import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack, For, Show } from 'solid-js'
import { Trash2, Pause, Play, X, Plus, Filter, ExternalLink, ChevronDown, ChevronUp } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { SubscriptionGroup } from 'screeps-connectivity'
import type { ConsoleMessage } from 'screeps-connectivity'
import { showLog, showConsole, showMemory, showSegments, toggleShowLog, toggleShowConsole, toggleShowMemory, toggleShowSegments, consoleInput, setConsoleInput, registerConsoleInput, loadConsoleHistory, pushConsoleHistory, historyPrev, historyNext, resetHistoryCursor } from '~/stores/consoleStore.js'
import { completeConsole, type ConsoleCompletionResult } from '~/editor/consoleCompletion.js'
import { watches, tempWatch, memoryValues, addWatch, removeWatch, clearTempWatch, initMemorySubscriptions } from '~/stores/memoryStore.js'
import { isCustomUiLine } from '~/stores/customUiStore.js'
import { hideCustomUiProtocol } from '~/stores/settingsStore.js'
import { MemoryTree } from '~/components/MemoryTree.js'
import { currentShard } from '~/stores/roomDataStore.js'
import { createLogger } from '~/utils/log.js'
import { LS, getJson, setJson } from '~/utils/storage.js'
import { isPopoutWindow } from '~/popout/protocol.js'
import { openPopoutWindow, popoutSid } from '~/popout/host.js'
import { isTauri } from '~/utils/tauri.js'

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
                  rootPath={creepPath}
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
                rootPath={path}
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
  // When paused, incoming console messages are held here instead of being
  // appended to the feed, then flushed on resume.
  const [paused, setPaused] = createSignal(false)
  let pendingEntries: ConsoleEntry[] = []
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
    // Subscription callback (an event handler); reading paused() here is an
    // intentional read of the current value, not a reactive dependency.
    // eslint-disable-next-line solid/reactivity
    group.add(c.stores.user.on('user:console', (data) => {
      const msg = data.messages as ConsoleMessage
      const entry: ConsoleEntry = {
        id: nextId++,
        log: msg.log ?? [],
        results: msg.results ?? [],
        error: msg.error ?? [],
      }
      if (paused()) {
        pendingEntries.push(entry)
        if (pendingEntries.length > 200) pendingEntries = pendingEntries.slice(pendingEntries.length - 200)
        return
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

  // Turning every pane off collapses the bar, turning one back on re-expands it.
  // isCollapsed is read untracked so this never fires on a height change — the
  // user collapsing the bar by hand (drag handle or the button below) must stick.
  // The first run only collapses, so a bar left collapsed stays collapsed.
  let initialCollapseSync = true
  createEffect(() => {
    const allOff = !showLog() && !showConsole() && !showMemory()
    const isInitial = initialCollapseSync
    initialCollapseSync = false
    untrack(() => {
      if (allOff && !props.isCollapsed) props.onToggle?.()
      else if (!allOff && props.isCollapsed && !isInitial) props.onToggle?.()
    })
  })

  const toggleBar = () => {
    // Expanding with every pane off would just reveal an empty area — bring the
    // console back instead, which re-expands the bar through the effect above.
    if (props.isCollapsed && !showLog() && !showConsole() && !showMemory()) {
      toggleShowConsole()
      return
    }
    props.onToggle?.()
  }

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

  onMount(() => loadConsoleHistory())

  // --- Command line: history + TypeScript completions ---
  // The two share the arrow keys. Because we own the dropdown state, the rule is
  // just: list open → navigate the list, otherwise → walk the history.

  let commandInputEl: HTMLInputElement | undefined
  let completionListEl: HTMLDivElement | undefined
  const [completions, setCompletions] = createSignal<ConsoleCompletionResult | null>(null)
  const [completionIdx, setCompletionIdx] = createSignal(0)
  const completionsOpen = () => completions() !== null

  const closeCompletions = () => {
    setCompletions(null)
    setCompletionIdx(0)
  }

  const caretPos = () => commandInputEl?.selectionStart ?? consoleInput().length

  // Loads the TypeScript worker on first use, so a session that never triggers a
  // completion never pays for the compiler chunk.
  const requestCompletions = (source: string, pos: number, explicit: boolean) => {
    completeConsole(source, pos, explicit)
      .then((result) => {
        // A response that no longer matches the input is stale — the user kept
        // typing, or stepped into the history while the request was in flight.
        if (source !== consoleInput()) return
        if (!result) {
          closeCompletions()
          return
        }
        setCompletions(result)
        setCompletionIdx(0)
      })
      .catch((err) => {
        error('completion failed:', err)
        closeCompletions()
      })
  }

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const value = e.currentTarget.value
    const pos = e.currentTarget.selectionStart ?? value.length
    resetHistoryCursor()
    setConsoleInput(value)
    // Only pop open on '.', where completions are unambiguously wanted. Opening
    // on every word character would make ArrowUp unreachable and fire a worker
    // round-trip per keystroke. Once open, keep refining as the user narrows.
    if (value.slice(pos - 1, pos) === '.' || completionsOpen()) requestCompletions(value, pos, false)
    else closeCompletions()
  }

  const moveCompletion = (delta: number) => {
    const options = completions()?.options
    if (!options) return
    const next = (completionIdx() + delta + options.length) % options.length
    setCompletionIdx(next)
  }

  const acceptCompletion = () => {
    const result = completions()
    if (!result) return
    const option = result.options[completionIdx()]
    if (!option) return
    const value = consoleInput()
    const cursor = result.from + option.label.length
    setConsoleInput(value.slice(0, result.from) + option.label + value.slice(caretPos()))
    closeCompletions()
    requestAnimationFrame(() => commandInputEl?.setSelectionRange(cursor, cursor))
  }

  // Keep the highlighted entry visible while arrowing through a long list.
  createEffect(() => {
    completions()
    const el = completionListEl?.children[completionIdx()] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault()
      requestCompletions(consoleInput(), caretPos(), true)
      return
    }

    if (completionsOpen()) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveCompletion(1)
          return
        case 'ArrowUp':
          e.preventDefault()
          moveCompletion(-1)
          return
        case 'Enter':
        case 'Tab':
          // preventDefault also stops the form from submitting the half-typed command.
          e.preventDefault()
          acceptCompletion()
          return
        case 'Escape':
          e.preventDefault()
          closeCompletions()
          return
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const entry = historyPrev(consoleInput())
      if (entry !== null) setConsoleInput(entry)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const entry = historyNext()
      if (entry !== null) setConsoleInput(entry)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      resetHistoryCursor()
      setConsoleInput('')
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const c = client()
    const cmd = consoleInput().trim()
    if (!c || !cmd) return
    closeCompletions()
    // Recorded before the request: a command that fails is exactly the one worth
    // recalling and fixing.
    pushConsoleHistory(cmd)
    setConsoleInput('')
    try {
      await c.http.user.console(cmd, props.shard ?? 'shard0')
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

  // Custom-UI protocol lines (SCUI marker) are hidden from both panes — the
  // customUiStore consumes them and turns them into toasts/navigation. The
  // filter can be turned off in Settings for debugging.
  const hideLine = (l: string) => hideCustomUiProtocol() && isCustomUiLine(l)

  // Regex filter for the Log pane. Compiled once per filter-text change; an
  // invalid pattern is surfaced (red input) and matches nothing is applied.
  const [showFilter, setShowFilter] = createSignal(false)
  const [filterText, setFilterText] = createSignal('')
  const compiledFilter = createMemo<{ re: RegExp | null; error: boolean }>(() => {
    const t = filterText().trim()
    if (!t) return { re: null, error: false }
    try {
      return { re: new RegExp(t, 'i'), error: false }
    } catch {
      return { re: null, error: true }
    }
  })
  // Strip HTML colour markup for filter matching. DOMParser produces an inert
  // document (no script execution, no resource loads), so this extracts the
  // visible text without a fragile tag-stripping regex.
  const stripMarkup = (line: string) =>
    new DOMParser().parseFromString(line, 'text/html').body.textContent ?? ''

  // Match against the visible text, ignoring the HTML colour markup in the line.
  const matchesFilter = (line: string) => {
    const re = compiledFilter().re
    if (!re) return true
    return re.test(stripMarkup(line))
  }

  // Log pane shows logs and errors together in arrival order: within a tick,
  // logs first then errors, and ticks stay chronological so new lines (errors
  // included) land at the bottom next to the surrounding log output.
  const logPaneLines = () =>
    entries()
      .flatMap((e) => [
        ...e.log.filter((l) => !hideLine(l)).map((line) => ({ kind: 'log' as const, line })),
        ...e.error.map((line) => ({ kind: 'error' as const, line })),
      ])
      .filter((item) => matchesFilter(item.line))
  const resultLines = () => entries().flatMap((e) => e.results).filter((l) => !hideLine(l))

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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (showLog() && logScrollRef) logScrollRef.scrollTop = logScrollRef.scrollHeight
      if (showConsole() && consoleScrollRef) consoleScrollRef.scrollTop = consoleScrollRef.scrollHeight
    })
  }

  // Open the currently visible panes in a popout window served by this window
  const openPopout = () => {
    const sid = popoutSid()
    if (!sid) return
    const panes = [showLog() && 'log', showConsole() && 'console', showMemory() && 'memory']
      .filter((pane): pane is string => Boolean(pane))
    openPopoutWindow({
      sid,
      panes: panes.length > 0 ? panes : ['log', 'console'],
      shard: props.shard ?? currentShard(),
    })
  }

  // Resume the feed: flush any messages buffered while paused, then scroll down.
  const resumeConsole = () => {
    if (pendingEntries.length > 0) {
      const flush = pendingEntries
      pendingEntries = []
      setEntries((prev) => {
        const next = [...prev, ...flush]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    }
    setPaused(false)
    setAutoScroll(true)
    scrollToBottom()
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
        <Show when={!isPopoutWindow}>
          <div style={{ width: '1px', height: '16px', background: '#30363d' }} />
          {/* Not a pane toggle — opens the full-canvas segment editor overlay. */}
          <button onClick={toggleShowSegments} title="View and edit raw memory segments" style={toggleBtnStyle(showSegments())}>Segments</button>
        </Show>
        <div style={{ flex: 1 }} />
        {/* Tauri webviews can't window.open; popouts are browser/embedded only */}
        <Show when={!isPopoutWindow && !isTauri() && popoutSid()}>
          <button
            onClick={openPopout}
            title="Open these panes in a separate window"
            style={iconBtnStyle}
          >
            <ExternalLink size={14} />
          </button>
        </Show>
        {/* Collapse to the bar itself; the panes keep their on/off state */}
        <Show when={props.onToggle}>
          <button
            onClick={toggleBar}
            title={props.isCollapsed ? 'Show the panels' : 'Hide the panels'}
            style={iconBtnStyle}
          >
            {props.isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </Show>
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
                  onClick={() => paused() ? resumeConsole() : setPaused(true)}
                  title={paused() ? 'Resume console' : 'Pause console'}
                  style={iconBtnStyle}
                >
                  {paused() ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                  onClick={() => setEntries([])}
                  title="Clear"
                  style={iconBtnStyle}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setShowFilter((v) => !v)}
                  title={filterText().trim() ? `Filter: ${filterText()}` : 'Filter (regex)'}
                  style={{ ...iconBtnStyle, color: filterText().trim() ? '#58a6ff' : '#8b949e' }}
                >
                  <Filter size={16} />
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
                {/* Regex filter bar */}
                <Show when={showFilter()}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', padding: '6px 8px', 'border-bottom': '1px solid #30363d' }}>
                    <input
                      type="text"
                      value={filterText()}
                      onInput={(e) => setFilterText(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setShowFilter(false) }}
                      ref={(el) => requestAnimationFrame(() => el.focus())}
                      placeholder="filter regex — e.g. error|creep"
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        'border-radius': '4px',
                        border: `1px solid ${compiledFilter().error ? '#f85149' : '#30363d'}`,
                        background: '#161b22',
                        color: '#c9d1d9',
                        'font-size': '12px',
                        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    />
                    <Show when={filterText()}>
                      <button style={iconBtnStyle} title="Clear filter" onClick={() => setFilterText('')}>
                        <X size={14} />
                      </button>
                    </Show>
                  </div>
                </Show>

                <div
                  ref={logScrollRef}
                  class="console-scroll"
                  onScroll={() => {
                    if (!logScrollRef) return
                    setAutoScroll(logScrollRef.scrollHeight - logScrollRef.scrollTop - logScrollRef.clientHeight < 20)
                  }}
                  style={{ flex: 1, overflow: 'auto', padding: '8px', ...monoStyle }}
                >
                  {logPaneLines().length === 0 && (
                    <div style={{ color: '#484f58', 'font-style': 'italic' }}>
                      {filterText().trim() && entries().length > 0 ? 'No lines match the filter.' : 'No log output yet…'}
                    </div>
                  )}
                  <For each={logPaneLines()}>
                    {(item) => (
                      <div style={{ 'margin-bottom': '4px', color: item.kind === 'error' ? '#f85149' : '#c9d1d9', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}
                        /* eslint-disable-next-line solid/no-innerhtml */
                        innerHTML={item.line}
                      />
                    )}
                  </For>
                </div>
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
                style={{ display: 'flex', gap: '6px', padding: '8px', 'border-top': '1px solid #30363d', position: 'relative' }}
              >
                <Show when={completions()}>
                  {(result) => (
                    <div
                      ref={(el) => { completionListEl = el }}
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '20px',
                        'max-height': '220px',
                        'min-width': '220px',
                        'max-width': 'calc(100% - 28px)',
                        'overflow-y': 'auto',
                        background: '#161b22',
                        border: '1px solid #30363d',
                        'border-radius': '4px',
                        'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.4)',
                        'z-index': 10,
                      }}
                    >
                      <For each={result().options}>
                        {(option, i) => (
                          <div
                            // Mousedown rather than click: it fires before the input
                            // loses focus, so preventDefault keeps the caret put.
                            onMouseDown={(e) => { e.preventDefault(); setCompletionIdx(i()); acceptCompletion() }}
                            style={{
                              display: 'flex',
                              gap: '8px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              'font-size': '12px',
                              'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              background: i() === completionIdx() ? '#1f6feb' : 'transparent',
                              color: i() === completionIdx() ? '#fff' : '#c9d1d9',
                            }}
                          >
                            <span style={{ color: i() === completionIdx() ? '#c9d1d9' : '#8b949e', 'min-width': '52px' }}>
                              {option.type ?? ''}
                            </span>
                            <span>{option.label}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </Show>
                <span style={{ color: '#8b949e', 'font-size': '13px', 'line-height': '28px' }}>&gt;</span>
                <input
                  type="text"
                  ref={(el) => { commandInputEl = el; registerConsoleInput(el) }}
                  value={consoleInput()}
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onBlur={closeCompletions}
                  autocomplete="off"
                  spellcheck={false}
                  placeholder="Game.creeps.Harvester1.moveTo(10, 10)   ·   Ctrl+Space"
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
