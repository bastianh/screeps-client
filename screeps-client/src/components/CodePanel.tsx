import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js'
import { SubscriptionGroup } from 'screeps-connectivity'
import { createCodeMirror, createEditorControlledValue } from 'solid-codemirror'
import { basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from 'codemirror'
import { Compartment } from '@codemirror/state'
import { client } from '~/stores/clientStore.js'
import { addToast } from '~/stores/toastStore.js'
import { createLogger } from '~/utils/log.js'
import { LS, getStr, setStr, getJson, setJson } from '~/utils/storage.js'
import { parseServerModules, serializeModules, tsModuleNames, type ModuleLang, type LogicalModule } from '~/editor/codeModules.js'
import { bytesToBase64, base64ToBytes, base64ByteSize, formatByteSize } from '~/utils/base64.js'
import { getTsWorker, syncModuleToWorker, modulePath } from '~/editor/tsClient.js'
import { tsExtensions } from '~/editor/tsExtensions.js'

const { error } = createLogger('code')

interface Branch {
  _id: string
  branch: string
  activeWorld: boolean
  activeSim: boolean
}

const editorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': {
    'font-family': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    'font-size': '13px',
    'line-height': '1.6',
    overflow: 'auto',
  },
  '.cm-gutters': { background: '#0d1117', 'border-right': '1px solid #21262d' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#484f58', 'min-width': '3em' },
  '.cm-activeLineGutter': { background: '#161b22' },
  '.cm-activeLine': { background: '#161b22' },
})

// Language + TS-service extensions live in a compartment so they can be swapped
// when the active module changes (plain JS vs TypeScript, and per-file path).
const cmBaseExtensions = [basicSetup, oneDark, editorTheme]

export function CodePanel(props: { onClose: () => void }) {
  const [branches, setBranches] = createSignal<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = createSignal<string>('')
  const [modules, setModules] = createSignal<Record<string, string>>({})
  // Per-module language. A module with no entry is plain JS.
  const [langs, setLangs] = createSignal<Record<string, ModuleLang>>({})
  const [activeModule, setActiveModule] = createSignal<string>('')
  const [loading, setLoading] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  const [activating, setActivating] = createSignal(false)
  const [showNew, setShowNew] = createSignal(false)
  const [newBranchName, setNewBranchName] = createSignal('')
  const [creatingBranch, setCreatingBranch] = createSignal(false)
  const [showNewFile, setShowNewFile] = createSignal(false)
  const [newFileName, setNewFileName] = createSignal('')
  const [newFileLang, setNewFileLang] = createSignal<ModuleLang>('ts')
  const [hoveredModule, setHoveredModule] = createSignal('')
  // When set, the editor shows the read-only transpiled JS of this TS module
  // (the `<name>.js` generated entry) instead of an editable source module.
  const [compiledView, setCompiledView] = createSignal<string | null>(null)
  const [compiledSrc, setCompiledSrc] = createSignal('')

  const moduleNames = () => Object.keys(modules())
  const langOf = (name: string): ModuleLang => langs()[name] ?? 'js'
  const isActive = () => branches().find((b) => b.branch === selectedBranch())?.activeWorld ?? false
  // Binary module active: the editor is hidden and a summary panel shown instead.
  const wasmView = () => !compiledView() && !!activeModule() && langOf(activeModule()) === 'wasm'

  // Persisted view state — where the editor was when it was last closed.
  const initialBranch = getStr(LS.codeBranch)
  const initialModule = getStr(LS.codeModule)
  // Cursor offset per branch → module, so each file reopens where you left off.
  const cursors: Record<string, Record<string, number>> = getJson(LS.codeCursors, {})

  // While true, editor updates (doc/selection changes from a module switch or
  // cursor restore) must not overwrite the saved cursor for that module.
  let applying = false

  const saveCursor = (pos: number) => {
    if (applying) return
    if (compiledView() || wasmView()) return // read-only views have no persisted cursor
    const b = selectedBranch()
    const m = activeModule()
    if (!b || !m) return
    ;(cursors[b] ??= {})[m] = pos
    setJson(LS.codeCursors, cursors)
  }

  const { editorView, ref: editorRef, createExtension } = createCodeMirror({
    onValueChange: (value) => {
      // The generated view is read-only; its compiled JS must never be written
      // back into a module's source.
      if (compiledView()) return
      const mod = activeModule()
      // Skip if value matches stored — avoids false dirty on module switch or initial load.
      // Binary modules never take editor text (their editor doc is kept empty).
      if (!mod || langOf(mod) === 'wasm' || modules()[mod] === value) return
      setModules((prev) => ({ ...prev, [mod]: value }))
      setDirty(true)
    },
  })

  // Restore the saved cursor whenever the active module changes. Created before
  // createEditorControlledValue so it runs first and sets `applying` before the
  // controlled-value effect replaces the document (which would otherwise fire a
  // save with a reset cursor).
  createEffect(() => {
    const b = selectedBranch()
    const m = activeModule()
    applying = true
    const pos = b && m ? cursors[b]?.[m] : undefined
    queueMicrotask(() => {
      const view = editorView()
      if (view && m && pos != null) {
        const anchor = Math.min(pos, view.state.doc.length)
        view.dispatch({ selection: { anchor }, scrollIntoView: true })
      }
      applying = false
    })
  })

  createEditorControlledValue(editorView, () =>
    compiledView() ? compiledSrc() : wasmView() ? '' : (modules()[activeModule()] ?? ''),
  )
  const langCompartment = new Compartment()
  createExtension([...cmBaseExtensions, langCompartment.of(javascript())])
  createExtension(EditorView.updateListener.of((u) => {
    if (u.selectionSet || u.docChanged) saveCursor(u.state.selection.main.head)
  }))

  // Reconfigure the language layer when the active module changes. TS modules get
  // the in-browser TypeScript service (completion, hover, diagnostics) bound to
  // their vfs path; JS modules get plain JavaScript support. The TS worker (and
  // its heavy compiler chunk) only loads the first time a TS module is opened.
  createEffect(() => {
    const view = editorView()
    if (!view) return
    // Read-only view of transpiled JS: plain JS highlighting, no user editing.
    // Use `editable.of(false)` (not `readOnly`) so the controlled value can still
    // swap the document programmatically when switching back to the source.
    if (compiledView()) {
      view.dispatch({ effects: langCompartment.reconfigure([javascript(), EditorView.editable.of(false)]) })
      return
    }
    const name = activeModule()
    const lang = langOf(name)
    if (!name) return
    if (lang === 'wasm') return // editor hidden; nothing to configure
    if (lang === 'ts') {
      getTsWorker()
        // eslint-disable-next-line solid/reactivity -- intentional: read current module state at resolve time, not tracked (would reconfigure on every keystroke)
        .then(async (worker) => {
          // Seed every text module so cross-module imports resolve in the
          // service. Binary modules carry base64, not code — skip them.
          await Promise.all(
            Object.entries(modules())
              .filter(([n]) => langOf(n) !== 'wasm')
              .map(([n, src]) =>
                worker.updateFile({ path: modulePath(n, langOf(n) as 'js' | 'ts'), code: src }),
              ),
          )
          if (activeModule() !== name) return // switched away while loading
          view.dispatch({
            effects: langCompartment.reconfigure([
              javascript({ typescript: true }),
              tsExtensions(worker, modulePath(name, 'ts')),
            ]),
          })
        })
        .catch((err) => error('ts service failed:', err))
    } else {
      view.dispatch({ effects: langCompartment.reconfigure(javascript()) })
    }
  })

  // Remember the open branch/module across close & reopen.
  createEffect(() => {
    const b = selectedBranch()
    if (b) setStr(LS.codeBranch, b)
  })
  createEffect(() => {
    const m = activeModule()
    if (m) setStr(LS.codeModule, m)
  })

  // Load the branch list. `select` picks which branch to select afterwards:
  // by name (after creating one), or falls back to the persisted / active / first branch.
  const loadBranches = (c: NonNullable<ReturnType<typeof client>>, select?: string) =>
    c.http.user.branches()
      .then((res) => {
        setBranches(res.list)
        const preferred = select ?? initialBranch
        const saved = preferred ? res.list.find((b) => b.branch === preferred) : undefined
        const active = saved ?? res.list.find((b) => b.activeWorld) ?? res.list[0]
        if (active) setSelectedBranch(active.branch)
      })
      .catch((err) => {
        error('branches failed:', err)
        addToast('Failed to load branches', 'error')
      })

  createEffect(() => {
    const c = client()
    if (!c) return
    loadBranches(c)
  })

  // Keep the active-branch indicator live: the server pushes on this channel
  // whenever the active branch changes (including from another client/session).
  createEffect(() => {
    const c = client()
    if (!c) return
    const group = new SubscriptionGroup()
    group.add(c.stores.user.subscribe('set-active-branch'))
    group.add(c.stores.user.on('user:setActiveBranch', ({ activeName, branch }) => {
      setBranches((prev) => prev.map((b) => ({ ...b, [activeName]: b.branch === branch })))
    }))
    onCleanup(() => group.dispose())
  })

  createEffect(() => {
    const branch = selectedBranch()
    const c = client()
    if (!branch || !c) return
    // Ignore this fetch's result if the selection changes before it resolves.
    // onCleanup runs right before the effect re-runs on the next branch switch,
    // so a slow response for a previous branch can't clobber the current one.
    let stale = false
    onCleanup(() => { stale = true })
    setLoading(true)
    setModules({})
    setLangs({})
    setCompiledView(null)
    setActiveModule('')
    setDirty(false)
    c.http.user.code.get(branch)
      .then((res) => {
        if (stale) return
        // Fold the server's flat map (compiled JS + hidden `.ts` sources) into
        // logical modules, then split into parallel source/lang maps the editor
        // works with.
        const logical = parseServerModules(res.modules ?? {})
        const src: Record<string, string> = {}
        const lg: Record<string, ModuleLang> = {}
        for (const m of logical) {
          src[m.name] = m.source
          lg[m.name] = m.lang
        }
        setModules(src)
        setLangs(lg)
        const names = logical.map((m) => m.name)
        const restore = branch === initialBranch && initialModule && names.includes(initialModule)
        setActiveModule(restore ? initialModule : names[0] ?? '')
      })
      .catch((err) => {
        if (stale) return
        error('get failed:', err)
        addToast('Failed to load code', 'error')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
  })

  // Open an editable source module.
  const openSource = (name: string) => {
    setCompiledView(null)
    setActiveModule(name)
  }

  // Open the read-only compiled JS of a TS module, transpiled live from its
  // current source so it always reflects what a Save would deploy.
  const viewCompiled = async (name: string) => {
    setActiveModule(name)
    try {
      const worker = await getTsWorker()
      setCompiledSrc(await worker.transpile(modules()[name] ?? ''))
      setCompiledView(name)
    } catch (err) {
      error('transpile failed:', err)
      addToast('Failed to compile module', 'error')
    }
  }

  // Convert a module between JS and TS. The source text is kept as-is (JS is
  // valid TS; a TS→JS switch leaves any type syntax for the user to clean up).
  // On the next Save the server representation is rebuilt: JS→TS adds the hidden
  // `<name>.ts` sibling, TS→JS drops it.
  const convertModuleLang = (name: string, target: ModuleLang) => {
    if (!name || langOf(name) === target) return
    setLangs((prev) => ({ ...prev, [name]: target }))
    setDirty(true)
    if (compiledView() === name) setCompiledView(null)
    if (target === 'ts') void syncModuleToWorker(name, 'ts', modules()[name] ?? '').catch(() => {})
  }

  const handleSave = async () => {
    const c = client()
    const branch = selectedBranch()
    if (!c || !branch) return
    setSaving(true)
    try {
      const logical: LogicalModule[] = moduleNames().map((n) => ({
        name: n,
        lang: langOf(n),
        source: modules()[n] ?? '',
      }))
      // Transpile TS modules to JS (type errors don't block — transpileModule
      // always emits). Both the compiled JS and the `.ts` source get persisted.
      const tsNames = tsModuleNames(logical)
      const compiled: Record<string, string> = {}
      if (tsNames.length) {
        const worker = await getTsWorker()
        await Promise.all(
          // eslint-disable-next-line solid/reactivity -- snapshot module sources inside this async click handler
          tsNames.map(async (n) => { compiled[n] = await worker.transpile(modules()[n] ?? '') }),
        )
      }
      await c.http.user.code.set(branch, serializeModules(logical, compiled))
      addToast('Code saved', 'success')
      setDirty(false)
    } catch (err) {
      error('set failed:', err)
      addToast('Failed to save code', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Logical module names carry no extension (the UI appends .js/.ts from the
  // module's language), so strip one the user may have typed. New/deleted modules
  // only touch local state — they're persisted to the server on the next Save.
  const handleAddFile = () => {
    const name = newFileName().trim().replace(/\.(ts|js)$/i, '')
    if (!name) return
    if (modules()[name] !== undefined) {
      addToast(`Module "${name}" already exists`, 'error')
      return
    }
    const lang = newFileLang()
    setModules((prev) => ({ ...prev, [name]: '' }))
    setLangs((prev) => ({ ...prev, [name]: lang }))
    if (lang === 'ts') void syncModuleToWorker(name, 'ts', '').catch(() => {})
    setCompiledView(null)
    setActiveModule(name)
    setDirty(true)
    setShowNewFile(false)
    setNewFileName('')
  }

  const handleDeleteFile = (name: string) => {
    if (name === 'main') return // main is the entry module and can't be removed
    if (!confirm(`Delete module "${name}.${langOf(name)}"? This takes effect when you Save.`)) return
    let remaining: string[] = []
    setModules((prev) => {
      const next = { ...prev }
      delete next[name]
      remaining = Object.keys(next)
      return next
    })
    setLangs((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    if (compiledView() === name) setCompiledView(null)
    if (activeModule() === name) { setCompiledView(null); setActiveModule(remaining[0] ?? '') }
    setDirty(true)
  }

  // Hidden file input for WASM uploads. When `wasmReplaceTarget` is set the
  // picked file replaces that module (keeping its name); otherwise the module
  // name comes from the file name.
  let wasmInput: HTMLInputElement | undefined
  let wasmReplaceTarget: string | null = null

  const pickWasmFile = (replace?: string) => {
    wasmReplaceTarget = replace ?? null
    if (wasmInput) {
      wasmInput.value = '' // re-picking the same file must still fire `change`
      wasmInput.click()
    }
  }

  const handleWasmFile = async (file: File) => {
    const name = wasmReplaceTarget ?? file.name.replace(/\.wasm$/i, '').trim()
    wasmReplaceTarget = null
    if (!name) return
    if (modules()[name] !== undefined && langOf(name) !== 'wasm') {
      addToast(`Module "${name}" already exists as .${langOf(name)}`, 'error')
      return
    }
    try {
      const b64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
      setModules((prev) => ({ ...prev, [name]: b64 }))
      setLangs((prev) => ({ ...prev, [name]: 'wasm' }))
      setCompiledView(null)
      setActiveModule(name)
      setDirty(true)
    } catch (err) {
      error('wasm read failed:', err)
      addToast('Failed to read WASM file', 'error')
    }
  }

  const handleWasmDownload = (name: string) => {
    const bytes = base64ToBytes(modules()[name] ?? '')
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.wasm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSetActive = () => {
    const c = client()
    const branch = selectedBranch()
    if (!c || !branch || isActive()) return
    setActivating(true)
    c.http.user.setActiveBranch('activeWorld', branch)
      .then(() => {
        addToast(`Branch "${branch}" now running on server`, 'success')
        setBranches((prev) => prev.map((b) => ({ ...b, activeWorld: b.branch === branch })))
      })
      .catch((err) => {
        error('setActiveBranch failed:', err)
        addToast('Failed to set active branch', 'error')
      })
      .finally(() => setActivating(false))
  }

  const handleCreateBranch = () => {
    const c = client()
    const name = newBranchName().trim()
    const from = selectedBranch()
    if (!c || !name) return
    if (branches().some((b) => b.branch === name)) {
      addToast(`Branch "${name}" already exists`, 'error')
      return
    }
    setCreatingBranch(true)
    // Clone the currently-selected branch's code into the new branch. With no
    // existing branch to clone from, ask the server to seed default modules.
    c.http.user.cloneBranch(name, from || undefined, from ? undefined : true)
      .then(() => {
        addToast(`Branch "${name}" created`, 'success')
        setShowNew(false)
        setNewBranchName('')
        return loadBranches(c, name)
      })
      .catch((err) => {
        error('cloneBranch failed:', err)
        addToast('Failed to create branch', 'error')
      })
      .finally(() => setCreatingBranch(false))
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: '0px',
        background: '#0d1117',
        'z-index': 100,
        display: 'flex',
        'flex-direction': 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '12px',
          padding: '10px 16px',
          'border-bottom': '1px solid #30363d',
          'flex-shrink': 0,
        }}
      >
        <span style={{ 'font-size': '15px', 'font-weight': 600, color: '#c9d1d9' }}>Code</span>

        <select
          value={selectedBranch()}
          onChange={(e) => setSelectedBranch(e.currentTarget.value)}
          style={{
            background: '#010409',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            'border-radius': '4px',
            padding: '4px 8px',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          <For each={branches()}>
            {(b) => (
              <option value={b.branch}>
                {b.branch}{b.activeWorld ? ' ★' : ''}
              </option>
            )}
          </For>
        </select>

        <Show
          when={showNew()}
          fallback={
            <button
              onClick={() => setShowNew(true)}
              title="Create a new branch from the selected one"
              style={{
                padding: '4px 10px',
                'border-radius': '4px',
                border: '1px solid #30363d',
                background: '#161b22',
                color: '#c9d1d9',
                'font-size': '12px',
                cursor: 'pointer',
              }}
            >
              ＋ New branch
            </button>
          }
        >
          <input
            autofocus
            value={newBranchName()}
            placeholder="branch name"
            onInput={(e) => setNewBranchName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBranch()
              else if (e.key === 'Escape') { setShowNew(false); setNewBranchName('') }
            }}
            style={{
              background: '#010409',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              'border-radius': '4px',
              padding: '4px 8px',
              'font-size': '12px',
              width: '140px',
            }}
          />
          <button
            onClick={handleCreateBranch}
            disabled={creatingBranch() || !newBranchName().trim()}
            style={{
              padding: '4px 10px',
              'border-radius': '4px',
              border: '1px solid #238636',
              background: creatingBranch() || !newBranchName().trim() ? '#161b22' : '#1a3a2a',
              color: creatingBranch() || !newBranchName().trim() ? '#484f58' : '#3fb950',
              'font-size': '12px',
              cursor: creatingBranch() || !newBranchName().trim() ? 'default' : 'pointer',
            }}
          >
            {creatingBranch() ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => { setShowNew(false); setNewBranchName('') }}
            style={{
              padding: '4px 10px',
              'border-radius': '4px',
              border: '1px solid #30363d',
              background: '#161b22',
              color: '#8b949e',
              'font-size': '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </Show>

        <button
          onClick={handleSetActive}
          disabled={activating() || isActive() || !selectedBranch()}
          title={isActive() ? 'This branch is running on the server' : 'Set this branch to run on the server'}
          style={{
            padding: '4px 10px',
            'border-radius': '4px',
            border: `1px solid ${isActive() ? '#30363d' : '#1f6feb'}`,
            background: isActive() ? '#161b22' : '#12233f',
            color: isActive() ? '#484f58' : '#58a6ff',
            'font-size': '12px',
            cursor: activating() || isActive() || !selectedBranch() ? 'default' : 'pointer',
          }}
        >
          {isActive() ? '★ Running on server' : activating() ? 'Setting…' : 'Run on server'}
        </button>

        <div style={{ flex: 1 }} />

        <Show when={dirty()}>
          <span style={{ 'font-size': '11px', color: '#e3b341' }}>Unsaved changes</span>
        </Show>

        <button
          onClick={handleSave}
          disabled={saving() || loading() || !dirty()}
          style={{
            padding: '5px 14px',
            'border-radius': '4px',
            border: '1px solid #238636',
            background: saving() || !dirty() ? '#161b22' : '#1a3a2a',
            color: saving() || !dirty() ? '#484f58' : '#3fb950',
            'font-size': '12px',
            cursor: saving() || !dirty() ? 'default' : 'pointer',
            'font-weight': 600,
          }}
        >
          {saving() ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={() => props.onClose()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8b949e',
            'font-size': '18px',
            cursor: 'pointer',
            'line-height': '1',
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Body: module list + editor */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Module list */}
        <div
          style={{
            width: '180px',
            'flex-shrink': 0,
            'border-right': '1px solid #21262d',
            display: 'flex',
            'flex-direction': 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              padding: '4px 6px 4px 10px',
              'border-bottom': '1px solid #21262d',
              'flex-shrink': 0,
            }}
          >
            <span
              style={{
                flex: 1,
                'font-size': '10px',
                'font-weight': 700,
                color: '#8b949e',
                'text-transform': 'uppercase',
                'letter-spacing': '0.06em',
              }}
            >
              Modules
            </span>
            <input
              ref={(el) => (wasmInput = el)}
              type="file"
              accept=".wasm,application/wasm"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) void handleWasmFile(file)
              }}
            />
            <button
              onClick={() => pickWasmFile()}
              disabled={loading() || !selectedBranch()}
              title="Upload a WebAssembly module (.wasm)"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                'font-size': '13px',
                'line-height': '1',
                cursor: loading() || !selectedBranch() ? 'default' : 'pointer',
                padding: '0 4px',
              }}
            >
              ⇪
            </button>
            <button
              onClick={() => { setShowNewFile((v) => !v); setNewFileName('') }}
              disabled={loading() || !selectedBranch()}
              title="Add a new module"
              style={{
                background: 'transparent',
                border: 'none',
                color: showNewFile() ? '#58a6ff' : '#8b949e',
                'font-size': '16px',
                'line-height': '1',
                cursor: loading() || !selectedBranch() ? 'default' : 'pointer',
                padding: '0 4px',
              }}
            >
              ＋
            </button>
          </div>
          <Show when={showNewFile()}>
            <div style={{ display: 'flex', gap: '4px', padding: '6px', 'border-bottom': '1px solid #21262d' }}>
              <input
                autofocus
                value={newFileName()}
                placeholder="module name"
                onInput={(e) => setNewFileName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFile()
                  else if (e.key === 'Escape') { setShowNewFile(false); setNewFileName('') }
                }}
                style={{
                  flex: 1,
                  'min-width': 0,
                  background: '#010409',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  'border-radius': '4px',
                  padding: '3px 6px',
                  'font-size': '12px',
                }}
              />
              <button
                onClick={() => setNewFileLang((l) => (l === 'ts' ? 'js' : 'ts'))}
                title="Toggle module language"
                style={{
                  padding: '3px 8px',
                  'border-radius': '4px',
                  border: '1px solid #30363d',
                  background: '#161b22',
                  color: newFileLang() === 'ts' ? '#58a6ff' : '#e3b341',
                  'font-size': '11px',
                  'font-weight': 600,
                  cursor: 'pointer',
                  'flex-shrink': 0,
                }}
              >
                .{newFileLang()}
              </button>
              <button
                onClick={handleAddFile}
                disabled={!newFileName().trim()}
                style={{
                  padding: '3px 8px',
                  'border-radius': '4px',
                  border: '1px solid #238636',
                  background: newFileName().trim() ? '#1a3a2a' : '#161b22',
                  color: newFileName().trim() ? '#3fb950' : '#484f58',
                  'font-size': '12px',
                  cursor: newFileName().trim() ? 'pointer' : 'default',
                  'flex-shrink': 0,
                }}
              >
                Add
              </button>
            </div>
          </Show>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Show when={loading()}>
              <div style={{ padding: '12px 10px', 'font-size': '12px', color: '#484f58', 'font-style': 'italic' }}>
                Loading…
              </div>
            </Show>
            <For each={moduleNames()}>
              {(name) => {
                const sourceActive = () => activeModule() === name && !compiledView()
                const genActive = () => compiledView() === name
                return (
                  <>
                    <div
                      onClick={() => openSource(name)}
                      onMouseEnter={() => setHoveredModule(name)}
                      onMouseLeave={() => setHoveredModule((h) => (h === name ? '' : h))}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '4px',
                        padding: '7px 8px 7px 12px',
                        'font-size': '12px',
                        cursor: 'pointer',
                        background: sourceActive() ? '#1f3158' : 'transparent',
                        color: sourceActive() ? '#58a6ff' : '#c9d1d9',
                        'border-left': `2px solid ${sourceActive() ? '#388bfd' : 'transparent'}`,
                      }}
                    >
                      <span
                        title={`${name}.${langOf(name)}`}
                        style={{ flex: 1, overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}
                      >
                        {name}
                        <span style={{ color: langOf(name) === 'ts' ? '#58a6ff' : langOf(name) === 'wasm' ? '#d2a8ff' : '#6e7681' }}>
                          .{langOf(name)}
                        </span>
                      </span>
                      <Show when={name !== 'main' && hoveredModule() === name}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFile(name) }}
                          title={`Delete ${name}.${langOf(name)}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#8b949e',
                            'font-size': '13px',
                            'line-height': '1',
                            cursor: 'pointer',
                            padding: '0 2px',
                            'flex-shrink': 0,
                          }}
                        >
                          ✕
                        </button>
                      </Show>
                    </div>
                    {/* Read-only compiled JS of a TS module — transpiled on click. */}
                    <Show when={langOf(name) === 'ts'}>
                      <div
                        onClick={() => void viewCompiled(name)}
                        title={`${name}.js — generated from ${name}.ts (read-only)`}
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          padding: '5px 8px 5px 24px',
                          'font-size': '11px',
                          'font-style': 'italic',
                          cursor: 'pointer',
                          background: genActive() ? '#1f3158' : 'transparent',
                          color: genActive() ? '#79c0ff' : '#6e7681',
                          'border-left': `2px solid ${genActive() ? '#388bfd' : 'transparent'}`,
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                          {name}.js
                        </span>
                        <span style={{ 'font-size': '9px', 'font-style': 'normal', 'flex-shrink': 0 }}>generated</span>
                      </div>
                    </Show>
                  </>
                )
              }}
            </For>
          </div>
        </div>

        {/* Editor column */}
        <div style={{ flex: 1, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>

          {/* Module name tab — always in DOM but hidden when no module */}
          <div
            style={{
              display: activeModule() ? 'flex' : 'none',
              'align-items': 'center',
              gap: '8px',
              padding: '4px 8px 4px 14px',
              'font-size': '12px',
              color: '#8b949e',
              'border-bottom': '1px solid #21262d',
              'flex-shrink': 0,
              'font-family': 'monospace',
              background: '#0d1117',
            }}
          >
            <span style={{ flex: 1 }}>
              {activeModule()}.{compiledView() ? 'js' : langOf(activeModule())}
              <Show when={compiledView()}>
                <span style={{ 'margin-left': '8px', color: '#6e7681', 'font-style': 'italic' }}>
                  generated · read-only
                </span>
              </Show>
              <Show when={wasmView()}>
                <span style={{ 'margin-left': '8px', color: '#6e7681', 'font-style': 'italic' }}>
                  binary · {formatByteSize(base64ByteSize(modules()[activeModule()] ?? ''))}
                </span>
              </Show>
            </span>
            <Show when={activeModule() && !compiledView() && langOf(activeModule()) !== 'wasm'}>
              <button
                onClick={() => convertModuleLang(activeModule(), langOf(activeModule()) === 'ts' ? 'js' : 'ts')}
                title={langOf(activeModule()) === 'ts'
                  ? 'Convert this module to plain JavaScript'
                  : 'Convert this module to TypeScript'}
                style={{
                  padding: '3px 10px',
                  'border-radius': '4px',
                  border: '1px solid #30363d',
                  background: '#161b22',
                  color: langOf(activeModule()) === 'ts' ? '#e3b341' : '#58a6ff',
                  'font-size': '11px',
                  'font-family': 'inherit',
                  cursor: 'pointer',
                }}
              >
                {langOf(activeModule()) === 'ts' ? 'Convert to JS' : 'Convert to TS'}
              </button>
            </Show>
          </div>

          {/* CodeMirror mount point — always in DOM so the view persists across module switches */}
          <div
            ref={editorRef}
            style={{
              display: activeModule() && !wasmView() ? 'flex' : 'none',
              flex: 1,
              overflow: 'hidden',
              'flex-direction': 'column',
            }}
          />

          {/* Binary module summary — WASM payloads have no editable text */}
          <Show when={wasmView()}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                'justify-content': 'center',
                gap: '10px',
                color: '#8b949e',
                'font-size': '13px',
              }}
            >
              <div style={{ 'font-family': 'monospace', 'font-size': '14px', color: '#d2a8ff' }}>
                {activeModule()}.wasm
              </div>
              <div>
                WebAssembly module · {formatByteSize(base64ByteSize(modules()[activeModule()] ?? ''))}
              </div>
              <div style={{ 'font-size': '12px', color: '#6e7681' }}>
                Binary modules can't be edited here. In game, load it with{' '}
                <code style={{ color: '#c9d1d9' }}>require('{activeModule()}')</code>.
              </div>
              <div style={{ display: 'flex', gap: '8px', 'margin-top': '6px' }}>
                <button
                  onClick={() => handleWasmDownload(activeModule())}
                  style={{
                    padding: '4px 12px',
                    'border-radius': '4px',
                    border: '1px solid #30363d',
                    background: '#161b22',
                    color: '#c9d1d9',
                    'font-size': '12px',
                    cursor: 'pointer',
                  }}
                >
                  Download
                </button>
                <button
                  onClick={() => pickWasmFile(activeModule())}
                  title="Replace this module with another .wasm file"
                  style={{
                    padding: '4px 12px',
                    'border-radius': '4px',
                    border: '1px solid #30363d',
                    background: '#161b22',
                    color: '#c9d1d9',
                    'font-size': '12px',
                    cursor: 'pointer',
                  }}
                >
                  Replace…
                </button>
              </div>
            </div>
          </Show>

          {/* Placeholder shown when no module is active */}
          <Show when={!activeModule()}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                color: '#484f58',
                'font-size': '13px',
                'font-style': 'italic',
              }}
            >
              {loading() ? 'Loading code…' : 'Select a module'}
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
