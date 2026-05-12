import { onMount } from 'solid-js'
import { client, status, tryAutoConnect } from '~/stores/clientStore.js'
import { LoginForm } from '~/components/LoginForm.js'
import { Dashboard } from './Dashboard.js'

export function App() {
  const isConnected = () => status() === 'connected' && client() !== null

  onMount(() => {
    if (status() === 'idle') {
      tryAutoConnect().catch(() => {})
    }
  })

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {isConnected() ? <Dashboard /> : <LoginForm />}
    </div>
  )
}
