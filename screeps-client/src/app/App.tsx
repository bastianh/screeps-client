import { client, status } from '~/stores/clientStore.js'
import { LoginForm } from '~/components/LoginForm.js'
import { Dashboard } from './Dashboard.js'

export function App() {
  const isConnected = () => status() === 'connected' && client() !== null

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {isConnected() ? <Dashboard /> : <LoginForm />}
    </div>
  )
}
