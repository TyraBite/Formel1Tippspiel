import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { EventPage } from './pages/EventPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { HistoryPage } from './pages/HistoryPage'
import { AdminPage } from './pages/AdminPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-f1-muted">
      Laden...
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter basename="/Formel1Tippspiel">
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<HomePage />} />
          <Route path="event/:eventId" element={<EventPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="history/:eventId" element={<HistoryPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
