import type { Subscription } from '../subscription/index.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedStore<EventMap extends Record<string, any>> extends EventTarget {
  emit<K extends string & keyof EventMap>(type: K, detail: EventMap[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  on<K extends string & keyof EventMap>(
    type: K,
    handler: (detail: EventMap[K]) => void,
  ): Subscription {
    const listener = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail)
    this.addEventListener(type, listener)
    return { dispose: () => this.removeEventListener(type, listener) }
  }
}
