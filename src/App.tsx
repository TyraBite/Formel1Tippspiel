import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { EventPage } from './pages/EventPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { HistoryPage } from './pages/HistoryPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-f1-muted">
      Laden...
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { user } = useAuth()
  return (
    <BrowserRouter basename="/f1-tipping-game">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<HomePage />} />
          <Route path="event/:eventId" element={<EventPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="history/:eventId" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
