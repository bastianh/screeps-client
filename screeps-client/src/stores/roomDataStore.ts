import { createSignal } from 'solid-js'
import type { ApiRoomDecorationItem, Badge } from 'screeps-connectivity'

export type RoomUsersMap = Record<string, { _id: string; username: string; badge?: Badge }>

const [roomObjectCount, setRoomObjectCount] = createSignal<number | null>(null)
const [roomOwner, setRoomOwner] = createSignal<{ userId: string; username: string } | null>(null)
const [controllerLevel, setControllerLevel] = createSignal<number | null>(null)
const [controllerProgress, setControllerProgress] = createSignal<number | null>(null)
const [controllerReservation, setControllerReservation] = createSignal<{ user: string; endTime: number } | null>(null)
const [structureCounts, setStructureCounts] = createSignal<Record<string, number>>({})
const [roomUsers, setRoomUsers] = createSignal<RoomUsersMap | null>(null)
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
