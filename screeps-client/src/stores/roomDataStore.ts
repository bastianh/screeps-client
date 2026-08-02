import { createSignal } from 'solid-js'
import type { ApiRoomDecorationItem, Badge } from 'screeps-connectivity'

export type RoomUsersMap = Record<string, { _id: string; username: string; badge?: Badge }>

// Same keys, identical values. Several of the signals below are rebuilt from the
// room update on every tick, so without a value comparison their fresh object
// identity would notify every consumer once per tick over unchanged content.
function sameRecord<T>(a: Record<string, T> | null, b: Record<string, T> | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

const [roomObjectCount, setRoomObjectCount] = createSignal<number | null>(null)
// Owner and reservation are rebuilt from the controller on every room update.
// Compared by value so an unchanged owner doesn't notify consumers through a fresh
// object identity — a per-tick notification tears down and recreates DOM that never
// changed, which loses clicks on any button inside it.
const [roomOwner, setRoomOwner] = createSignal<{ userId: string; username: string } | null>(null, {
  equals: (a, b) => a?.userId === b?.userId && a?.username === b?.username,
})
const [controllerLevel, setControllerLevel] = createSignal<number | null>(null)
const [controllerProgress, setControllerProgress] = createSignal<number | null>(null)
const [controllerReservation, setControllerReservation] = createSignal<{ user: string; endTime: number } | null>(null, {
  equals: (a, b) => a?.user === b?.user && a?.endTime === b?.endTime,
})
// Counted from scratch on every room update; the tallies are identical whenever no
// structure appeared or vanished. The users map is usually re-emitted as the same
// reference, but the room store respreads it whenever the server resends users.
const [structureCounts, setStructureCounts] = createSignal<Record<string, number>>({}, { equals: sameRecord })
const [roomUsers, setRoomUsers] = createSignal<RoomUsersMap | null>(null, { equals: sameRecord })
const [currentShard, setCurrentShard] = createSignal<string | null>(null)
const [currentRoom, setCurrentRoom] = createSignal<string | null>(null)
// Raw decoration items of the current room. The renderer keeps its own parsed copy;
// this is what the sidebar panel and the creep properties panel read.
const [roomDecorationItems, setRoomDecorationItems] = createSignal<readonly ApiRoomDecorationItem[]>([])
// Bumped whenever this client places or removes a decoration. The room view re-reads
// `game/room-decorations` on every change: the room socket only carries decorations when
// the server volunteers them, so without this an activation from the inventory stayed
// invisible until the room was reloaded.
const [decorationsRevision, setDecorationsRevision] = createSignal(0)

/** Ask the room view to re-read its decorations. */
export function invalidateRoomDecorations(): void {
  setDecorationsRevision(v => v + 1)
}

export { roomObjectCount, setRoomObjectCount, roomOwner, setRoomOwner, controllerLevel, setControllerLevel, controllerProgress, setControllerProgress, controllerReservation, setControllerReservation, structureCounts, setStructureCounts, roomUsers, setRoomUsers, currentShard, setCurrentShard, currentRoom, setCurrentRoom, roomDecorationItems, setRoomDecorationItems, decorationsRevision }
