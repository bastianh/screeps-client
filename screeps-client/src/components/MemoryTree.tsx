import { createSignal, For, Show, onMount } from 'solid-js'
import { ChevronRight, ChevronDown, Terminal, Loader, Check, X, RefreshCw } from 'lucide-solid'
import { insertConsole } from '~/stores/consoleStore.js'
import { client } from '~/stores/clientStore.js'
import { createLogger } from '~/utils/log.js'

const { error } = createLogger('MemoryTree')

/** Sentinel emitted by subscribeMemory when the server can't serialize the object over WS. */
function isPending(v: unknown): boolean {
  return v !== null && typeof v === 'object' && '__screeps_object__' in (v as object)
}

interface MemoryTreeProps {
  value: unknown
  /** Full JS-style path, e.g. "Memory.creeps['Harvester1']" */
  path: string
  label: string
  shard: string | null
  depth?: number
  onRefresh?: () => void
}

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
  padding: '2px',
  'border-radius': '3px',
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  'flex-shrink': 0,
} as const

/** Convert a Memory.x.y path to the API path (strips leading "Memory.") */
function toApiPath(memPath: string): string {
  return memPath.replace(/^Memory\.?/, '')
}

function MemoryNode(props: MemoryTreeProps) {
  // depth never changes post-mount (structural recursion), safe to read once
  // eslint-disable-next-line solid/reactivity
  const [expanded, setExpanded] = createSignal((props.depth ?? 0) < 2)
  const nodeDepth = () => props.depth ?? 0
  const [editing, setEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  // Holds HTTP-fetched value for object placeholders; reset when props.value changes back to pending
  const [fetchedValue, setFetchedValue] = createSignal<unknown>(undefined)

  // The value we actually render: prefer the locally-fetched value over the WS placeholder
  const effectiveValue = () => (isPending(props.value) && fetchedValue() !== undefined) ? fetchedValue() : props.value

  const isObject = () => {
    const v = effectiveValue()
    return !isPending(v) && v !== null && typeof v === 'object'
  }
  const entries = () => isObject() ? Object.entries(effectiveValue() as Record<string, unknown>) : []
  const childCount = () => entries().length

  const fetchPending = async () => {
    setLoading(true)
    try {
      const c = client()
      if (!c) return
      const apiPath = toApiPath(props.path)
      const res = await c.http.user.memory.get(apiPath, props.shard) as { data: unknown }
      // Private servers may return '[object Object]' even via HTTP — re-use the WS sentinel
      const value = res.data === '[object Object]' ? { __screeps_object__: true } : res.data
      setFetchedValue(value)
    } catch (err) {
      error('fetch memory failed', err)
    } finally {
      setLoading(false)
    }
  }

  const refetch = () => {
    setFetchedValue(undefined)
    void fetchPending()
  }

  onMount(() => {
    if (expanded() && isPending(props.value) && fetchedValue() === undefined) {
      void fetchPending()
    }
  })

  const handleExpand = async () => {
    if (isPending(props.value) && fetchedValue() === undefined) {
      await fetchPending()
      setExpanded(true)
      return
    }
    if (expanded()) setFetchedValue(undefined)
    setExpanded((v) => !v)
  }

  const commitEdit = async () => {
    const raw = editValue().trim()
    let parsed: unknown
    if (raw === 'null') parsed = null
    else if (raw === 'true') parsed = true
    else if (raw === 'false') parsed = false
    else {
      const n = Number(raw)
      if (!Number.isNaN(n) && raw !== '') parsed = n
      else {
        try { parsed = JSON.parse(raw) }
        catch { parsed = raw }
      }
    }
    const c = client()
    if (!c) return
    const apiPath = toApiPath(props.path)
    try {
      await c.http.user.memory.set(apiPath, parsed, props.shard)
    } catch (err) {
      error('set memory failed', err)
      setEditing(false)
      return
    }
    setEditing(false)
    props.onRefresh?.()
  }

  const labelColor = () => {
    const v = effectiveValue()
    if (isObject()) return '#c9d1d9'
    if (typeof v === 'string') return '#3fb950'
    if (typeof v === 'number') return '#79c0ff'
    if (typeof v === 'boolean') return '#a371f7'
    return '#8b949e'
  }

  const displayValue = () => {
    const v = effectiveValue()
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    if (typeof v === 'string') return JSON.stringify(v)
    return String(v)
  }

  return (
    <div style={{ 'padding-left': nodeDepth() > 0 ? '14px' : '0', ...monoStyle }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '2px', 'min-height': '20px' }}>
        {/* Expand toggle for objects/arrays and pending placeholders */}
        <Show when={isObject() || isPending(effectiveValue())}>
          <button
            style={{ ...iconBtnStyle, color: '#8b949e' }}
            onClick={() => void handleExpand()}
            title={expanded() ? 'Collapse' : 'Expand'}
            disabled={loading()}
          >
            <Show when={loading()}>
              <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
            </Show>
            <Show when={!loading()}>
              <Show when={expanded()} fallback={<ChevronRight size={12} />}>
                <ChevronDown size={12} />
              </Show>
            </Show>
          </button>
        </Show>
        <Show when={!isObject() && !isPending(effectiveValue())}>
          <span style={{ width: '18px', 'flex-shrink': 0 }} />
        </Show>

        {/* Label */}
        <span style={{ color: '#8b949e', 'flex-shrink': 0 }}>{props.label}</span>
        <span style={{ color: '#484f58', 'margin': '0 2px', 'flex-shrink': 0 }}>:</span>

        {/* Value / type summary */}
        <Show when={isPending(effectiveValue())}>
          <span style={{ color: '#484f58', 'font-style': 'italic' }}>{'{…}'}</span>
        </Show>
        <Show when={isObject()}>
          <span style={{ color: '#484f58', 'font-style': 'italic' }}>
            {Array.isArray(effectiveValue()) ? `[${childCount()}]` : `{${childCount()}}`}
          </span>
        </Show>

        {/* Reload button for HTTP-fetched nodes */}
        <Show when={isPending(props.value) && !loading()}>
          <button style={iconBtnStyle} title="Reload" onClick={() => refetch()}>
            <RefreshCw size={11} />
          </button>
        </Show>

        <Show when={!isObject() && !isPending(effectiveValue())}>
          <Show when={!editing()}>
            <span
              style={{ color: labelColor(), cursor: 'text', 'flex': 1 }}
              title="Click to edit"
              onClick={() => { setEditValue(displayValue()); setEditing(true) }}
            >
              {displayValue()}
            </span>
          </Show>
          <Show when={editing()}>
            <input
              type="text"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              autofocus
              style={{
                background: '#161b22',
                border: '1px solid #388bfd',
                color: '#c9d1d9',
                'border-radius': '3px',
                padding: '0 4px',
                'font-size': '12px',
                'font-family': 'inherit',
                flex: 1,
                'min-width': '60px',
              }}
            />
            <button style={{ ...iconBtnStyle, color: '#3fb950' }} title="Save" onMouseDown={(e) => { e.preventDefault(); void commitEdit() }}><Check size={12} /></button>
            <button style={{ ...iconBtnStyle, color: '#f85149' }} title="Discard" onMouseDown={(e) => { e.preventDefault(); setEditing(false) }}><X size={12} /></button>
          </Show>
        </Show>

        {/* Insert-to-console action */}
        <button
          style={iconBtnStyle}
          title={`Insert Memory.${toApiPath(props.path)} = into console`}
          onClick={() => insertConsole(`Memory.${toApiPath(props.path)} = `)}
        >
          <Terminal size={11} />
        </button>

      </div>

      {/* Children */}
      <Show when={isObject() && expanded()}>
        <For each={entries()}>
          {([key, val]) => {
            const childPath = Array.isArray(effectiveValue())
              ? `${props.path}[${key}]`
              : `${props.path}.${key}`
            return (
              <MemoryNode
                value={val}
                path={childPath}
                label={key}
                shard={props.shard}
                depth={nodeDepth() + 1}
                onRefresh={isPending(props.value) ? refetch : props.onRefresh}
              />
            )
          }}
        </For>
      </Show>
    </div>
  )
}

export function MemoryTree(props: { value: unknown; path: string; label: string; shard: string | null }) {
  return <MemoryNode value={props.value} path={props.path} label={props.label} shard={props.shard} depth={0} />
}
