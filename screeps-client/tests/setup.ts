// Vitest runs in a plain Node environment where localStorage/sessionStorage are
// undefined (Node only provides localStorage behind --localstorage-file). Store
// modules read localStorage at import time (e.g. settingsStore's boolSetting),
// so back both with an in-memory Storage before any test module loads.

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => { data.clear() },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => { data.delete(key) },
    setItem: (key: string, value: string) => { data.set(key, String(value)) },
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (globalThis[name] === undefined) {
    Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true })
  }
}
