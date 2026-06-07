import { useState, useEffect } from 'react'
import { subscribeToAllScores, getUsers } from '../lib/firestore'
import type { Score, AppUser } from '../types'

interface UserStats {
  user: AppUser
  totalPoints: number
  sessionWins: number
  sessionDraws: number
  sessionLosses: number
}

export function LeaderboardPage() {
  const [scores, setScores] = useState<Score[]>([])
  const [users, setUsers] = useState<AppUser[]>([])

  useEffect(() => {
    getUsers().then(setUsers)
    return subscribeToAllScores(setScores)
  }, [])

  const sessionKeys = [...new Set(scores.map(s => `${s.eventId}_${s.sessionType}`))]

  const stats: Record<string, UserStats> = {}
  for (const u of users) {
    stats[u.id] = { user: u, totalPoints: 0, sessionWins: 0, sessionDraws: 0, sessionLosses: 0 }
  }

  for (const key of sessionKeys) {
    const sessionScores = scores.filter(s => `${s.eventId}_${s.sessionType}` === key)
    for (const s of sessionScores) {
      if (stats[s.userId]) stats[s.userId].totalPoints += s.points
    }
    if (users.length === 2 && sessionScores.length === 2) {
      const [a, b] = sessionScores
      if (a.points > b.points) {
        stats[a.userId].sessionWins++; stats[b.userId].sessionLosses++
      } else if (b.points > a.points) {
        stats[b.userId].sessionWins++; stats[a.userId].sessionLosses++
      } else {
        stats[a.userId].sessionDraws++; stats[b.userId].sessionDraws++
      }
    }
  }

  const sorted = Object.values(stats).sort((a, b) => b.totalPoints - a.totalPoints)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rangliste</h1>

      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Gesamtpunkte</h2>
        {sorted.map((s, i) => (
          <div key={s.user.id} className={`flex items-center justify-between py-3 ${
            i < sorted.length - 1 ? 'border-b border-f1-border' : ''
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-f1-muted font-mono w-4">{i + 1}</span>
              <span className="font-semibold">{s.user.displayName}</span>
            </div>
            <span className="text-xl font-bold text-f1-red">{s.totalPoints}</span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-f1-muted text-sm">Noch keine Ergebnisse</p>
        )}
      </div>

      {users.length === 2 && sorted.length === 2 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Head to Head</h2>
          <div className="grid grid-cols-3 text-center gap-4 mb-4">
            <div>
              <p className="text-2xl font-bold">{sorted[0].totalPoints}</p>
              <p className="text-f1-muted text-sm">{sorted[0].user.displayName}</p>
            </div>
            <div className="text-f1-muted self-center text-sm font-semibold">PUNKTE</div>
            <div>
              <p className="text-2xl font-bold">{sorted[1].totalPoints}</p>
              <p className="text-f1-muted text-sm">{sorted[1].user.displayName}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 text-center gap-4 border-t border-f1-border pt-4">
            <div>
              <p className="text-xl font-bold text-f1-green">{sorted[0].sessionWins}</p>
              <p className="text-f1-muted text-xs">Siege</p>
            </div>
            <div>
              <p className="text-xl font-bold text-f1-muted">{sorted[0].sessionDraws}</p>
              <p className="text-f1-muted text-xs">Draws</p>
            </div>
            <div>
              <p className="text-xl font-bold text-f1-green">{sorted[1].sessionWins}</p>
              <p className="text-f1-muted text-xs">Siege</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
