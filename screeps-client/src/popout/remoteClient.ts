import type { ScreepsClient } from 'screeps-connectivity'
import type { PopoutRpc } from './rpc.js'
import { memoryTopic } from './protocol.js'

/**
 * A stand-in for ScreepsClient backed by the popout RPC channel instead of a
 * connection of its own. Only the surface used by the log/console/memory panes
 * is implemented — the cast below is the contract that popout windows render
 * nothing beyond those panes.
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
        },
      },
    },
    stores: {
      user: {
        subscribe: (channel: string) => rpc.subscribe(channel),
        subscribeMemory: (path: string, shard?: string | null) =>
          rpc.subscribe(memoryTopic(path, shard ?? null)),
        on: (topic: string, callback: (data: never) => void) => rpc.on(topic, callback),
      },
    },
  }
  return remote as unknown as ScreepsClient
}
