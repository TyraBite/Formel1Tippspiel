import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from './ThemeToggle'

const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-3 rounded text-sm font-medium uppercase tracking-wide transition-colors ${
    isActive
      ? 'bg-f1-red/10 text-f1-red font-bold'
      : 'text-f1-muted hover:text-white hover:bg-white/5'
  }`

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'text-f1-red font-bold text-sm uppercase tracking-wide'
    : 'text-f1-muted hover:text-white text-sm uppercase tracking-wide transition-colors'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  function close() { setMenuOpen(false) }

  return (
    <div className="min-h-screen">
      <nav className="bg-f1-card border-b border-f1-border border-t-[3px] border-t-f1-red px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4 md:gap-7">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2.5 shrink-0 text-left"
            aria-label="Menü öffnen"
          >
            <div className="flex flex-col gap-[3px]">
              <div className="h-[3px] w-5 bg-f1-red" />
              <div className="h-[3px] w-5 bg-f1-red" />
            </div>
            <span className="font-black tracking-tight text-base uppercase hidden sm:inline text-white">F1 Tipping</span>
          </button>
          <div className="hidden md:flex items-center gap-7">
            <NavLink to="/" end className={topLinkClass}>Tipps</NavLink>
            <NavLink to="/live" className={topLinkClass}>Live</NavLink>
            <NavLink to="/leaderboard" className={topLinkClass}>Rangliste</NavLink>
            <NavLink to="/stats" className={topLinkClass}>Statistiken</NavLink>
          </div>
        </div>
        <span className="hidden md:block text-f1-muted text-sm truncate max-w-[160px]">{user?.displayName}</span>
      </nav>

      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-200"
        style={{ opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none' }}
        onClick={close}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 left-0 h-full w-72 bg-f1-card border-r border-f1-border z-50 flex flex-col transition-transform duration-200 ease-out"
        style={{ transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-f1-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col gap-[3px]">
              <div className="h-[3px] w-5 bg-f1-red" />
              <div className="h-[3px] w-5 bg-f1-red" />
            </div>
            <span className="font-black tracking-tight text-base uppercase text-white">F1 Tipping</span>
          </div>
          <button onClick={close} className="text-f1-muted hover:text-white transition-colors p-1" aria-label="Menü schließen">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col flex-1 px-3 py-4 gap-0.5 overflow-y-auto">
          <NavLink to="/" end onClick={close} className={drawerLinkClass}>Tipps</NavLink>
          <NavLink to="/live" onClick={close} className={drawerLinkClass}>Live</NavLink>
          <NavLink to="/leaderboard" onClick={close} className={drawerLinkClass}>Rangliste</NavLink>
          <NavLink to="/stats" onClick={close} className={drawerLinkClass}>Statistiken</NavLink>
        </nav>

        <div className="px-5 py-4 border-t border-f1-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-f1-muted text-sm truncate">{user?.displayName}</span>
            <ThemeToggle />
          </div>
          <button
            onClick={() => logout().finally(() => navigate('/login'))}
            className="w-full text-left text-f1-muted hover:text-white text-sm uppercase tracking-wide transition-colors py-0.5"
          >
            Abmelden
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
