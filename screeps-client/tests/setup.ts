// Node 22+ defines a globalThis.localStorage getter that yields undefined unless
// --localstorage-file is passed, and it also shadows the jsdom environment's storage.
// Install a Map-backed stub whenever no usable localStorage exists — settingsStore
// reads it at module top level, so imports crash without one.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
}
