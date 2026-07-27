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

export { roomObjectCount, setRoomObjectCount, roomOwner, setRoomOwner, controllerLevel, setControllerLevel, controllerProgress, setControllerProgress, controllerReservation, setControllerReservation, structureCounts, setStructureCounts, roomUsers, setRoomUsers, currentShard, setCurrentShard, currentRoom, setCurrentRoom, roomDecorationItems, setRoomDecorationItems }
