import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeToEvents, getScores, getUsers, subscribeToEventTips } from '../lib/firestore'
import type { F1Event, Score, AppUser, Tip, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying', sprint_race: 'Sprint Race',
}

export function HistoryPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<F1Event | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [tips, setTips] = useState<Tip[]>([])

  useEffect(() => {
    if (!eventId) return
    const unsubEvents = subscribeToEvents(es => setEvent(es.find(e => e.id === eventId) ?? null))
    getScores(eventId).then(setScores)
    getUsers().then(setUsers)
    // Phase 2: lockedAt is set by the sync job when a session starts.
    // Until then, Firestore rules only return the current user's own tips.
    // Opponent tips become visible once the session starts (Phase 2).
    const unsubTips = subscribeToEventTips(eventId, setTips)
    return () => { unsubEvents(); unsubTips() }
  }, [eventId])

  if (!event) return <div className="text-f1-muted">Laden...</div>

  const tippable: TippableSessionType[] = event.isSprintWeekend
    ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
    : ['qualifying', 'race']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
      <p className="text-f1-muted mb-6">{event.circuit}</p>

      {tippable.map(sessionType => {
        const sessionScores = scores.filter(s => s.sessionType === sessionType)
        const sessionTips = tips.filter(t => t.sessionType === sessionType)

        return (
          <div key={sessionType} className="card mb-4">
            <h2 className="font-semibold mb-4">{SESSION_LABELS[sessionType]}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map(user => {
                const score = sessionScores.find(s => s.userId === user.id)
                const tip = sessionTips.find(t => t.userId === user.id)
                return (
                  <div key={user.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{user.displayName}</span>
                      {score && (
                        <div className="flex items-center gap-2">
                          <span className="text-f1-red font-bold">{score.points} Pkt</span>
                          {score.isProvisional && (
                            <span className="badge bg-yellow-900 text-yellow-300">⚠ vorläufig</span>
                          )}
                        </div>
                      )}
                    </div>
                    {tip ? (
                      <div className="text-sm space-y-1">
                        {score ? (
                          score.breakdown.map(b => (
                            <div key={b.pos} className={`flex items-center gap-2 py-0.5 rounded px-1 ${
                              b.points === 3 ? 'bg-f1-gold/10' : b.points === 1 ? 'bg-f1-green/10' : ''
                            }`}>
                              <span className="text-f1-muted font-mono w-4">{b.pos}</span>
                              <span className={b.points > 0 ? 'text-white' : 'text-f1-muted'}>
                                {b.predictedDriverId || '–'}
                              </span>
                              {b.points === 3 && <span className="text-f1-gold text-xs ml-auto">+3</span>}
                              {b.points === 1 && <span className="text-f1-green text-xs ml-auto">+1</span>}
                            </div>
                          ))
                        ) : (
                          Object.entries(tip.predictions)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([pos, driverId]) => (
                              <div key={pos} className="flex items-center gap-2 py-0.5 px-1">
                                <span className="text-f1-muted font-mono w-4">{pos}</span>
                                <span className="text-f1-muted">{driverId || '–'}</span>
                              </div>
                            ))
                        )}
                      </div>
                    ) : (
                      <p className="text-f1-muted text-sm">Kein Tipp abgegeben</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
