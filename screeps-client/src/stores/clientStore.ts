import { createSignal } from 'solid-js'
import { ScreepsClient, PasswordAuth, TokenAuth, IndexedDBStorage } from 'screeps-connectivity'
import type { AuthStrategy, StorageAdapter } from 'screeps-connectivity'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

const [client, setClient] = createSignal<ScreepsClient | null>(null)
const [status, setStatus] = createSignal<ConnectionStatus>('idle')
const [error, setError] = createSignal<string | null>(null)

export { client, status, error }

export async function connect(opts: {
  url: string
  auth: 'password' | 'token'
  email?: string
  password?: string
  token?: string
  storage?: StorageAdapter | null
}): Promise<void> {
  setStatus('connecting')
  setError(null)

  try {
    let authStrategy: AuthStrategy
    if (opts.auth === 'password') {
      if (!opts.email || !opts.password) {
        throw new Error('Email and password are required')
      }
      authStrategy = new PasswordAuth({ email: opts.email, password: opts.password })
    } else {
      if (!opts.token) {
        throw new Error('Token is required')
      }
      authStrategy = new TokenAuth({ token: opts.token })
    }

    const screepsClient = new ScreepsClient({
      url: opts.url,
      auth: authStrategy,
      storage: opts.storage ?? new IndexedDBStorage('screeps-client'),
    })

    screepsClient.stores.server.on('server:disconnected', (data) => {
      if (!data.willReconnect) {
        setStatus('idle')
        setClient(null)
      }
    })

    screepsClient.stores.server.on('server:error', (data) => {
      setError(data.error.message)
      setStatus('error')
    })

    await screepsClient.connect()
    setClient(screepsClient)
    setStatus('connected')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setError(message)
    setStatus('error')
    setClient(null)
    throw err
  }
}

export function disconnect(): void {
  const c = client()
  if (c) {
    c.disconnect()
  }
  setClient(null)
  setStatus('idle')
  setError(null)
}
