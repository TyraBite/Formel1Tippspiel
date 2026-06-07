import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <nav className="bg-f1-card border-b border-f1-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-f1-red" />
            <span className="font-bold tracking-tight text-lg">F1 TIPPING</span>
          </div>
          <NavLink to="/" end className={({ isActive }) =>
            isActive ? 'text-white font-medium text-sm' : 'text-f1-muted hover:text-white text-sm transition-colors'}>
            Home
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) =>
            isActive ? 'text-white font-medium text-sm' : 'text-f1-muted hover:text-white text-sm transition-colors'}>
            Rangliste
          </NavLink>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-f1-muted text-sm">{user?.displayName}</span>
          <button
            onClick={() => logout().finally(() => navigate('/login'))}
            className="text-f1-muted hover:text-white text-sm transition-colors">
            Abmelden
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
