import { createSignal, Show, For } from 'solid-js'
import { ChevronLeft, Pencil, Trash2, Check, X } from 'lucide-solid'
import { client } from '~/stores/clientStore.js'
import { goToUserPower } from '~/stores/routeStore.js'
import { addToast } from '~/stores/toastStore.js'
import {
  POWER_CLASS_INFO, POWER_CREEP_MAX_LEVEL, powersForClass,
  type PowerCreepClass, type PowerDef,
} from '~/data/powerCreeps.js'
import type { PowerContext, PowerNav } from './PowerCreeps.js'
import { PowerClassIcon } from './PowerClassIcon.js'
import { PowerTile } from './PowerTile.js'
import { ConfirmDialog } from './ConfirmDialog.js'
import { PANEL, BORDER, TEXT, MUTED, ACCENT, GREEN, GPL_TEXT, POWER_RED } from './theme.js'

export function PowerCreepDetail(props: { ctx: PowerContext; id: string | null; nav?: PowerNav }) {
  const creep = () => props.ctx.creeps().find((c) => c._id === props.id) ?? null
  const className = () => (creep()?.className ?? 'operator') as PowerCreepClass
  const backToList = () => (props.nav?.goToList ?? goToUserPower)()
  const powers = () => powersForClass(className())

  const [staged, setStaged] = createSignal<Record<number, number>>({})
  const [saving, setSaving] = createSignal(false)
  const [confirmSave, setConfirmSave] = createSignal(false)
  const [confirmReset, setConfirmReset] = createSignal(false)
  const [confirmDelete, setConfirmDelete] = createSignal(false)
  const [maxNotice, setMaxNotice] = createSignal(false)
  const [renaming, setRenaming] = createSignal(false)
  const [nameDraft, setNameDraft] = createSignal('')

  const savedLevel = (id: number) => creep()?.powers?.[id]?.level ?? 0
  const stagedLevel = (id: number) => staged()[id] ?? savedLevel(id)
  const totalIncrements = () => {
    let sum = 0
    for (const def of powers()) sum += stagedLevel(def.id) - savedLevel(def.id)
    return sum
  }
  const creepLevelStaged = () => (creep()?.level ?? 0) + totalIncrements()
  const freeRemaining = () => props.ctx.free() - totalIncrements()
  const dirty = () => totalIncrements() > 0

  // Next power level needs: an open level slot, free account level, room under the
  // creep's max level, and a high enough creep level for that power's threshold.
  const canIncrement = (def: PowerDef) => {
    const cur = stagedLevel(def.id)
    return cur < 5 && creepLevelStaged() < POWER_CREEP_MAX_LEVEL && freeRemaining() >= 1 && creepLevelStaged() >= def.reqLevel[cur]
  }
  const lockLevel = (def: PowerDef) => {
    const cur = stagedLevel(def.id)
    return cur < 5 && creepLevelStaged() < def.reqLevel[cur] ? def.reqLevel[cur] : undefined
  }
  const increment = (def: PowerDef) => {
    if (creepLevelStaged() >= POWER_CREEP_MAX_LEVEL) { setMaxNotice(true); return }
    if (!canIncrement(def)) return
    setStaged({ ...staged(), [def.id]: stagedLevel(def.id) + 1 })
  }

  const save = async () => {
    const c = client()
    const cr = creep()
    setConfirmSave(false)
    if (!c || !cr) return
    setSaving(true)
    try {
      const payload: Record<string, number> = {}
      for (const def of powers()) {
        const lvl = stagedLevel(def.id)
        if (lvl > 0) payload[def.id] = lvl
      }
      await c.http.game.powerCreeps.upgrade(cr._id, payload)
      await props.ctx.reload()
      await c.stores.user.refreshMe().catch(() => {})
      setStaged({})
      addToast('Power creep upgraded', 'success', 3000)
    } catch (err) {
      addToast(`Upgrade failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    } finally {
      setSaving(false)
    }
  }

  const doRename = async () => {
    const c = client()
    const cr = creep()
    const next = nameDraft().trim()
    setRenaming(false)
    if (!c || !cr || !next || next === cr.name) return
    try {
      await c.http.game.powerCreeps.rename(cr._id, next)
      await props.ctx.reload()
    } catch (err) {
      addToast(`Rename failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    }
  }

  const doDelete = async () => {
    const c = client()
    const cr = creep()
    setConfirmDelete(false)
    if (!c || !cr) return
    try {
      await c.http.game.powerCreeps.delete(cr._id)
      await props.ctx.reload()
      addToast(`Power creep "${cr.name}" deleted`, 'success', 3000)
      backToList()
    } catch (err) {
      addToast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    }
  }

  const cancelDelete = async () => {
    const c = client()
    const cr = creep()
    if (!c || !cr) return
    try {
      await c.http.game.powerCreeps.cancelDelete(cr._id)
      await props.ctx.reload()
    } catch (err) {
      addToast(`Failed to cancel deletion: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000)
    }
  }

  return (
    <Show when={creep()} fallback={
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '8px', padding: '32px', 'text-align': 'center', color: MUTED }}>
        Power creep not found. <a onClick={backToList} style={{ color: ACCENT, cursor: 'pointer' }}>Back to list</a>
      </div>
    }>
      {(cr) => (
        <div>
          <button
            onClick={backToList}
            style={{ display: 'inline-flex', 'align-items': 'center', gap: '4px', padding: '6px 10px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, 'font-size': '13px', cursor: 'pointer', 'margin-bottom': '16px' }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {/* Creep header */}
          <div style={{ display: 'flex', 'align-items': 'center', gap: '14px', background: PANEL, border: `1px solid ${BORDER}`, 'border-radius': '10px', padding: '18px 20px', 'margin-bottom': '16px' }}>
            <PowerClassIcon class={className()} size={44} color={GPL_TEXT} />
            <div style={{ flex: 1, 'min-width': 0 }}>
              <Show
                when={renaming()}
                fallback={
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <span style={{ color: TEXT, 'font-size': '18px', 'font-weight': 600 }}>{cr().name}</span>
                    <button onClick={() => { setNameDraft(cr().name); setRenaming(true) }} title="Rename" style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', padding: '2px' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                }
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                  <input
                    value={nameDraft()}
                    onInput={(e) => setNameDraft(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void doRename(); if (e.key === 'Escape') setRenaming(false) }}
                    maxLength={50}
                    style={{ padding: '4px 8px', 'border-radius': '4px', border: `1px solid ${BORDER}`, background: '#0d1117', color: TEXT, 'font-size': '15px', outline: 'none' }}
                  />
                  <button onClick={() => void doRename()} title="Save name" style={{ background: 'transparent', border: 'none', color: GREEN, cursor: 'pointer' }}><Check size={16} /></button>
                  <button onClick={() => setRenaming(false)} title="Cancel" style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer' }}><X size={16} /></button>
                </div>
              </Show>
              <div style={{ color: MUTED, 'font-size': '13px', 'margin-top': '2px' }}>
                {POWER_CLASS_INFO[className()].label} · Level <strong style={{ color: TEXT }}>{cr().level}</strong>
                <Show when={dirty()}><span style={{ color: ACCENT }}> → {creepLevelStaged()}</span></Show>
              </div>
            </div>

            {/* Budget + danger */}
            <div style={{ 'text-align': 'right', 'font-size': '12px', color: MUTED }}>
              <div>Free GPL <strong style={{ color: freeRemaining() > 0 ? GPL_TEXT : MUTED }}>{Math.max(0, freeRemaining())}</strong> / {props.ctx.gpl()}</div>
              <Show when={dirty()}><div style={{ color: ACCENT, 'margin-top': '2px' }}>{totalIncrements()} staged</div></Show>
            </div>
            <Show
              when={cr().deleteTime}
              fallback={
                <button onClick={() => setConfirmDelete(true)} title="Delete power creep" style={{ background: 'transparent', border: `1px solid ${BORDER}`, 'border-radius': '6px', color: '#f85149', cursor: 'pointer', padding: '7px 9px', display: 'flex' }}>
                  <Trash2 size={16} />
                </button>
              }
            >
              <button onClick={() => void cancelDelete()} style={{ background: 'transparent', border: '1px solid #f0883e', 'border-radius': '6px', color: '#f0883e', cursor: 'pointer', padding: '7px 10px', 'font-size': '12px' }}>
                Cancel deletion
              </button>
            </Show>
          </div>

          <Show when={creepLevelStaged() >= POWER_CREEP_MAX_LEVEL}>
            <div style={{ background: '#21262d', border: `1px solid ${BORDER}`, 'border-radius': '6px', padding: '8px 12px', 'font-size': '12px', color: '#f0883e', 'margin-bottom': '16px' }}>
              You have reached the maximum creep level ({POWER_CREEP_MAX_LEVEL}).
            </div>
          </Show>

          {/* Powers grid */}
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <For each={powers()}>
              {(def) => (
                <PowerTile
                  def={def}
                  currentLevel={savedLevel(def.id)}
                  stagedLevel={stagedLevel(def.id)}
                  editable
                  canIncrement={canIncrement(def)}
                  lockLevel={lockLevel(def)}
                  onIncrement={() => increment(def)}
                />
              )}
            </For>
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px', 'margin-top': '20px' }}>
            <button
              onClick={() => setConfirmReset(true)}
              disabled={!dirty() || saving()}
              style={{ padding: '9px 18px', 'border-radius': '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: dirty() ? TEXT : MUTED, 'font-size': '14px', cursor: dirty() ? 'pointer' : 'not-allowed', opacity: dirty() ? 1 : 0.6 }}
            >
              Reset
            </button>
            <button
              onClick={() => setConfirmSave(true)}
              disabled={!dirty() || saving()}
              style={{ padding: '9px 20px', 'border-radius': '6px', border: 'none', background: dirty() ? GREEN : '#21262d', color: dirty() ? '#fff' : MUTED, 'font-size': '14px', 'font-weight': 600, cursor: dirty() ? 'pointer' : 'not-allowed', opacity: dirty() ? 1 : 0.7 }}
            >
              {saving() ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          <Show when={confirmSave()}>
            <ConfirmDialog
              title="This action cannot be undone without deleting the creep."
              body={<>Do you want to proceed and use <strong style={{ color: GPL_TEXT }}>{creepLevelStaged() + 1} GPL</strong> for this creep?</>}
              onConfirm={() => void save()}
              onCancel={() => setConfirmSave(false)}
            />
          </Show>
          <Show when={confirmReset()}>
            <ConfirmDialog
              title="Do you really want to reset all changes?"
              onConfirm={() => { setStaged({}); setConfirmReset(false) }}
              onCancel={() => setConfirmReset(false)}
            />
          </Show>
          <Show when={confirmDelete()}>
            <ConfirmDialog
              title={`Do you really want to delete "${cr().name}"?`}
              body={
                <>
                  You will lose <strong style={{ color: POWER_RED }}>1 Power Level</strong> in your account.
                  The creep's upgrade levels are returned, but the creation level is gone for good.
                </>
              }
              confirmLabel="Delete"
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmDelete(false)}
            />
          </Show>
          <Show when={maxNotice()}>
            <ConfirmDialog
              title="You have reached the maximum creep level"
              notice
              onConfirm={() => setMaxNotice(false)}
              onCancel={() => setMaxNotice(false)}
            />
          </Show>
        </div>
      )}
    </Show>
  )
}
