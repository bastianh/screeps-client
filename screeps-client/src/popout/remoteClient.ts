import type { ScreepsClient } from 'screeps-connectivity'
import type { PopoutRpc } from './rpc.js'
import { MAP_STATS_TOPIC, map2Topic, mapVisualTopic, memoryTopic } from './protocol.js'

/**
 * A stand-in for ScreepsClient backed by the popout RPC channel instead of a
 * connection of its own. Only the surface used by the log/console/memory panes
 * and the world map is implemented — the cast below is the contract that popout
 * windows render nothing beyond those views.
 */
export function createRemoteClient(rpc: PopoutRpc): ScreepsClient {
  const remote = {
    http: {
      user: {
        console: (expression: string, shard?: string) =>
          rpc.call('console.exec', [expression, shard]),
        memory: {
          get: (path: string, shard?: string | null) =>
            rpc.call('memory.get', [path, shard]),
          set: (path: string, value: unknown, shard?: string | null) =>
            rpc.call('memory.set', [path, value, shard]),
          segment: {
            get: (segment: number, shard?: string | null) =>
              rpc.call('memory.segment.get', [segment, shard]),
          },
        },
        worldStartRoom: (shard?: string | null) => rpc.call('user.worldStartRoom', [shard]),
      },
    },
    stores: {
      user: {
        subscribe: (channel: string) => rpc.subscribe(channel),
        subscribeMemory: (path: string, shard?: string | null) =>
          rpc.subscribe(memoryTopic(path, shard ?? null)),
        subscribeMapVisual: (shard: string | null) => rpc.subscribe(mapVisualTopic(shard)),
        on: (topic: string, callback: (data: never) => void) => rpc.on(topic, callback),
      },
      room: {
        terrainBulk: (rooms: string[], shard: string | null) =>
          rpc.call('room.terrainBulk', [rooms, shard]),
      },
      map: {
        subscribeMap2: (room: string, shard: string | null) =>
          rpc.subscribe(map2Topic(room, shard)),
        on: (topic: string, callback: (data: never) => void) => rpc.on(topic, callback),
      },
      mapStats: {
        request: (rooms: string[], statName: string, shard?: string) => {
          void rpc.call('mapStats.request', [rooms, statName, shard])
        },
        // Listening implies wanting the event stream: piggyback the forwarding
        // gate topic on the listener so the map view needs no popout-specific
        // wiring of its own.
        on: (topic: string, callback: (data: never) => void) => {
          const gate = rpc.subscribe(MAP_STATS_TOPIC)
          const listener = rpc.on(topic, callback)
          return {
            dispose: () => {
              gate.dispose()
              listener.dispose()
            },
          }
        },
      },
      server: {
        worldInfo: (shard?: string) => rpc.call('server.worldInfo', [shard]),
      },
      // Navigating from a popout moves the main window's room view — the same
      // handoff the map popout does on a second click, reused by custom UI
      // responses that carry a room.
      navigation: {
        navigateTo: (room: string, shard: string | null) =>
          rpc.call('navigation.navigateTo', [room, shard]),
      },
    },
  }
  return remote as unknown as ScreepsClient
}
