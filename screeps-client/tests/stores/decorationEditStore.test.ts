import { describe, it, expect, beforeEach } from 'vitest'
import type { ApiRoomDecorationDef } from 'screeps-connectivity'
import {
  beginDecorationEdit, beginDecorationPlacement, decorateHint, decorationDraft,
  decorationPreviewItem, draftDirty, draftHasFrame, draftPlacement, setDraftPlacement,
  setDraftProp, startDecorationPlacement,
} from '../../src/stores/decorationEditStore'
import { roomViewMode, resetRoomViewMode } from '../../src/stores/roomViewStore'

const GRAFFITI: ApiRoomDecorationDef = {
  _id: 'def1',
  type: 'wallGraffiti',
  props: {
    x: { type: 'range', default: 0 },
    y: { type: 'range', default: 0 },
    width: { type: 'range', default: 4 },
    height: { type: 'range', default: 4 },
    rotation: { type: 'range', default: 0 },
    alpha: { type: 'range', default: 1 },
  },
}

const LANDSCAPE: ApiRoomDecorationDef = {
  _id: 'def2',
  type: 'wallLandscape',
  props: { backgroundColor: { type: 'color', default: '#000000' } },
}

function begin(decoration = GRAFFITI, active: Record<string, unknown> = {}) {
  beginDecorationEdit({
    _id: 'item1',
    decoration,
    active: { x: 10, y: 12, width: 4, height: 4, rotation: 0, alpha: 1, room: 'W1N1', ...active },
    wasActive: true,
  })
}

describe('decorationEditStore', () => {
  beforeEach(() => resetRoomViewMode())

  it('enters decorate mode with the stored placement', () => {
    begin()
    expect(roomViewMode()).toBe('decorate')
    expect(draftPlacement()).toEqual({ x: 10, y: 12, width: 4, height: 4, rotation: 0 })
    expect(draftHasFrame()).toBe(true)
    expect(draftDirty()).toBe(false)
  })

  it('leaving decorate mode drops the draft', () => {
    begin()
    resetRoomViewMode()
    expect(decorationDraft()).toBeNull()
    expect(draftPlacement()).toBeNull()
  })

  it('tracks placement edits and reports them as dirty', () => {
    begin()
    setDraftPlacement({ x: 20, y: 12, width: 6, height: 4, rotation: 0.5 })
    expect(draftPlacement()).toEqual({ x: 20, y: 12, width: 6, height: 4, rotation: 0.5 })
    expect(draftDirty()).toBe(true)
  })

  /**
   * The renderer is handed the draft so property edits show up live, but a drag must not
   * travel that way — it would rebuild the decoration layer on every pointer move.
   */
  it('pins the preview geometry while passing other edits through', () => {
    begin()
    setDraftPlacement({ x: 40, y: 44, width: 9, height: 9, rotation: 1 })
    setDraftProp('alpha', 0.5)

    const preview = decorationPreviewItem()
    expect(preview?._id).toBe('item1')
    expect(preview?.active.alpha).toBe(0.5)
    expect(preview?.active).toMatchObject({ x: 10, y: 12, width: 4, height: 4, rotation: 0 })
  })

  it('offers no frame for a decoration without geometry', () => {
    begin(LANDSCAPE, {})
    expect(draftHasFrame()).toBe(false)
    expect(decorationDraft()?.decoration.type).toBe('wallLandscape')
  })

  /** A graffiti parked over open floor draws nothing, which is worth saying outright. */
  it('warns that graffiti only shows on walls, and only for graffiti', () => {
    begin(GRAFFITI)
    expect(decorateHint().note).toMatch(/walls/i)

    begin(LANDSCAPE, {})
    expect(decorateHint().note).toBeUndefined()

    resetRoomViewMode()
    startDecorationPlacement()
    expect(decorateHint().note).toBeUndefined()
  })
})

describe('placing a decoration from the room view', () => {
  beforeEach(() => resetRoomViewMode())

  it('opens the picker with nothing selected', () => {
    startDecorationPlacement()
    expect(roomViewMode()).toBe('decorate')
    expect(decorationDraft()).toBeNull()
    expect(decorateHint().primary).toMatch(/pick a decoration/i)
  })

  /**
   * The schema defaults put a graffiti at the origin, which hides under the edge wall.
   * A 4×4 decoration therefore starts at (23,23) rather than (0,0).
   */
  it('centres a new placement in the room and targets the current room', () => {
    beginDecorationPlacement('item9', GRAFFITI, 'W5N5', 'shard2')

    expect(roomViewMode()).toBe('decorate')
    expect(draftPlacement()).toEqual({ x: 23, y: 23, width: 4, height: 4, rotation: 0 })
    expect(decorationDraft()?.active.room).toBe('W5N5')
    expect(decorationDraft()?.active.shard).toBe('shard2')
    expect(decorationDraft()?.wasActive).toBe(false)
    expect(decorateHint().primary).toMatch(/activate/i)
  })

  it('leaves the shard off a single-shard server', () => {
    beginDecorationPlacement('item9', GRAFFITI, 'W5N5', null)
    expect(decorationDraft()?.active.shard).toBeUndefined()
    expect(decorationDraft()?.active.room).toBe('W5N5')
  })

  it('does not move a decoration that has no position of its own', () => {
    beginDecorationPlacement('item9', LANDSCAPE, 'W5N5', null)
    expect(draftHasFrame()).toBe(false)
    expect(decorationDraft()?.active.x).toBeUndefined()
  })

  it('renders as a preview item so an unplaced decoration is visible before saving', () => {
    beginDecorationPlacement('item9', GRAFFITI, 'W5N5', null)
    const preview = decorationPreviewItem()
    expect(preview?._id).toBe('item9')
    expect(preview?.active).toMatchObject({ x: 23, y: 23, room: 'W5N5' })
  })
})
