import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <nav className="bg-f1-card border-b border-f1-border border-t-[3px] border-t-f1-red px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4 md:gap-7">
          <NavLink to="/" end className="flex items-center gap-2.5 shrink-0">
            <div className="flex flex-col gap-[3px]">
              <div className="h-[3px] w-5 bg-f1-red" />
              <div className="h-[3px] w-5 bg-f1-red" />
            </div>
            <span className="font-black tracking-tight text-base uppercase hidden sm:inline text-white">F1 Tipping</span>
          </NavLink>
          <NavLink to="/" end className={({ isActive }) =>
            isActive
              ? 'text-f1-red font-bold text-sm uppercase tracking-wide'
              : 'text-f1-muted hover:text-white text-sm uppercase tracking-wide transition-colors'}>
            Home
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) =>
            isActive
              ? 'text-f1-red font-bold text-sm uppercase tracking-wide'
              : 'text-f1-muted hover:text-white text-sm uppercase tracking-wide transition-colors'}>
            Rangliste
          </NavLink>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="text-f1-muted text-sm truncate max-w-[80px] md:max-w-none">{user?.displayName}</span>
          <button
            onClick={() => logout().finally(() => navigate('/login'))}
            className="text-f1-muted hover:text-white text-sm uppercase tracking-wide transition-colors whitespace-nowrap">
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
