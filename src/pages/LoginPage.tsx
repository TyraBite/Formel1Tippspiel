import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(`${username.toLowerCase().trim()}@f1tipping.local`, password)
    } catch {
      setError('Ungültiger Benutzername oder Passwort.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-f1-red" />
          <h1 className="text-2xl font-bold tracking-tight">F1 TIPPING</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white placeholder-f1-muted focus:outline-none focus:border-f1-red"
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white placeholder-f1-muted focus:outline-none focus:border-f1-red"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
