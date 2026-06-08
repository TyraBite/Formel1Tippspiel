import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToAllScores, getUsers, subscribeToEvents } from '../lib/firestore'
import { useAuth } from '../contexts/AuthContext'
import type { Score, AppUser, F1Event } from '../types'

interface UserStats {
  user: AppUser
  totalPoints: number
  sessionWins: number
  sessionDraws: number
  sessionLosses: number
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const [scores, setScores] = useState<Score[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [events, setEvents] = useState<F1Event[]>([])

  useEffect(() => {
    getUsers().then(setUsers)
    const unsubScores = subscribeToAllScores(setScores)
    const unsubEvents = subscribeToEvents(setEvents)
    return () => { unsubScores(); unsubEvents() }
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

  const now = new Date()
  const pastEvents = events
    .filter(e => e.sessions.race.startTime.toDate() <= now)
    .sort((a, b) => b.round - a.round)

  const eventIds = [...new Set(scores.map(s => s.eventId))]

  function eventPoints(eventId: string): number {
    return scores
      .filter(s => s.eventId === eventId && s.userId === user?.id)
      .reduce((sum, s) => sum + s.points, 0)
  }

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

      {users.length === 2 && sorted.length === 2 && (() => {
        const me = sorted.find(s => s.user.id === user?.id) ?? sorted[0]
        const opponent = sorted.find(s => s.user.id !== user?.id) ?? sorted[1]
        return (
          <div className="card mb-8">
            <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Head to Head</h2>
            <div className="grid grid-cols-3 text-center gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{me.totalPoints}</p>
                <p className="text-f1-muted text-sm">{me.user.displayName}</p>
              </div>
              <div className="text-f1-muted self-center text-sm font-semibold">PUNKTE</div>
              <div>
                <p className="text-2xl font-bold">{opponent.totalPoints}</p>
                <p className="text-f1-muted text-sm">{opponent.user.displayName}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 text-center gap-4 border-t border-f1-border pt-4">
              <div>
                <p className="text-xl font-bold text-f1-green">{me.sessionWins}</p>
                <p className="text-f1-muted text-xs">Siege</p>
              </div>
              <div>
                <p className="text-xl font-bold text-f1-muted">{me.sessionDraws}</p>
                <p className="text-f1-muted text-xs">Draws</p>
              </div>
              <div>
                <p className="text-xl font-bold text-f1-green">{opponent.sessionWins}</p>
                <p className="text-f1-muted text-xs">Siege</p>
              </div>
            </div>
          </div>
        )
      })()}

      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-3">Abgeschlossene Events</h2>
          <div className="flex flex-col gap-2">
            {pastEvents.map(event => {
              const pts = eventIds.includes(event.id) ? eventPoints(event.id) : null
              return (
                <Link key={event.id} to={`/history/${event.id}`}
                  className="card hover:border-f1-red transition-colors flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-f1-muted font-mono text-sm w-6">R{event.round}</span>
                    <span className="font-medium text-sm">{event.name}</span>
                    {event.isSprintWeekend && (
                      <span className="badge bg-f1-red text-white text-xs">S</span>
                    )}
                  </div>
                  {pts !== null
                    ? <span className="font-bold text-f1-red text-sm">{pts} Pkt</span>
                    : <span className="text-f1-muted text-xs">–</span>}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
