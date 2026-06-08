import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeToEvents, getScores, getUsers, getDrivers, getEventSessionResults, subscribeToEventTips } from '../lib/firestore'
import { useAuth } from '../contexts/AuthContext'
import type { F1Event, Score, AppUser, Tip, TippableSessionType, Driver, SessionResult } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying', sprint_race: 'Sprint Race',
}

export function HistoryPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<F1Event | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([])

  useEffect(() => {
    if (!eventId) return
    const parts = eventId.split('_')
    const year = parseInt(parts[parts.length - 1] ?? String(new Date().getFullYear()))
    const unsubEvents = subscribeToEvents(es => setEvent(es.find(e => e.id === eventId) ?? null))
    getScores(eventId).then(setScores)
    getUsers().then(setUsers)
    getDrivers(year).then(setDrivers)
    getEventSessionResults(eventId).then(setSessionResults)
    const unsubTips = subscribeToEventTips(eventId, setTips)
    return () => { unsubEvents(); unsubTips() }
  }, [eventId])

  if (!event) return <div className="text-f1-muted">Laden...</div>

  const driverName = (id: string) => drivers.find(d => d.id === id)?.name ?? id

  // driverId → actual position per session
  const actualPos: Record<string, Record<string, number>> = {}
  for (const r of sessionResults) {
    actualPos[r.sessionType] = {}
    for (const dr of r.results) actualPos[r.sessionType][dr.driverId] = dr.position
  }

  const tippable: TippableSessionType[] = event.isSprintWeekend
    ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
    : ['qualifying', 'race']

  // Weekend summary
  const me = users.find(u => u.id === user?.id)
  const opponent = users.find(u => u.id !== user?.id)
  const eventTotal = (userId: string) =>
    scores.filter(s => s.userId === userId).reduce((sum, s) => sum + s.points, 0)
  const myTotal = me ? eventTotal(me.id) : 0
  const opponentTotal = opponent ? eventTotal(opponent.id) : 0
  const hasScores = scores.length > 0

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{event.name}</h1>
      <p className="text-f1-muted text-sm mb-6">{event.circuit}</p>

      {hasScores && me && opponent && (
        <div className="card mb-6 border-l-4 border-l-f1-red">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-4">Weekend</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <p className={`text-3xl font-black ${myTotal > opponentTotal ? 'text-f1-red' : 'text-white'}`}>
                {myTotal}
              </p>
              <p className="text-f1-muted text-xs uppercase tracking-wide mt-1">{me.displayName}</p>
              {myTotal > opponentTotal && <p className="text-f1-red text-xs font-bold uppercase tracking-wide mt-1">Winner</p>}
            </div>
            <div className="text-f1-border text-sm font-black uppercase">VS</div>
            <div className="flex-1 text-center">
              <p className={`text-3xl font-black ${opponentTotal > myTotal ? 'text-f1-red' : 'text-white'}`}>
                {opponentTotal}
              </p>
              <p className="text-f1-muted text-xs uppercase tracking-wide mt-1">{opponent.displayName}</p>
              {opponentTotal > myTotal && <p className="text-f1-red text-xs font-bold uppercase tracking-wide mt-1">Winner</p>}
            </div>
          </div>
          {myTotal === opponentTotal && (
            <p className="text-center text-f1-muted text-xs font-bold uppercase tracking-widest mt-3">Unentschieden</p>
          )}
        </div>
      )}

      {tippable.map(sessionType => {
        const sessionScores = scores.filter(s => s.sessionType === sessionType)
        const sessionTips = tips.filter(t => t.sessionType === sessionType)
        const posMap = actualPos[sessionType] ?? {}

        return (
          <div key={sessionType} className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold uppercase tracking-wide text-sm">{SESSION_LABELS[sessionType]}</h2>
              {sessionScores.length > 0 && (
                <div className="flex gap-3">
                  {users.map(u => {
                    const s = sessionScores.find(sc => sc.userId === u.id)
                    return s ? (
                      <span key={u.id} className="text-xs text-f1-muted">
                        {u.displayName} <span className="text-white font-bold">{s.points}</span>
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {users.map(user => {
                const score = sessionScores.find(s => s.userId === user.id)
                const tip = sessionTips.find(t => t.userId === user.id)
                return (
                  <div key={user.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{user.displayName}</span>
                      {score && (
                        <div className="flex items-center gap-2">
                          <span className="text-f1-red font-black">{score.points} Pkt</span>
                          {score.isProvisional && (
                            <span className="badge bg-yellow-900 text-yellow-300">vorläufig</span>
                          )}
                        </div>
                      )}
                    </div>
                    {tip ? (
                      <div className="text-sm space-y-0.5">
                        {score ? (
                          score.breakdown.map(b => {
                            const ap = b.predictedDriverId ? posMap[b.predictedDriverId] : undefined
                            const showActual = b.points < 3 && ap !== undefined
                            return (
                              <div key={b.pos} className={`flex items-center gap-2 py-1 px-1.5 rounded ${
                                b.points === 3 ? 'bg-f1-gold/10' : b.points === 1 ? 'bg-f1-green/10' : ''
                              }`}>
                                <span className="text-f1-muted font-mono text-xs w-4 shrink-0">{b.pos}</span>
                                <span className={`flex-1 ${b.points > 0 ? 'text-white' : 'text-f1-muted'}`}>
                                  {b.predictedDriverId ? driverName(b.predictedDriverId) : '–'}
                                </span>
                                {showActual && (
                                  <span className={`text-xs font-mono shrink-0 ${
                                    b.points === 1 ? 'text-f1-green/70' : 'text-red-400/70'
                                  }`}>
                                    P{ap}
                                  </span>
                                )}
                                {b.points === 3 && <span className="text-f1-gold text-xs font-bold shrink-0">+3</span>}
                                {b.points === 1 && <span className="text-f1-green text-xs font-bold shrink-0">+1</span>}
                              </div>
                            )
                          })
                        ) : (
                          Object.entries(tip.predictions)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([pos, driverId]) => (
                              <div key={pos} className="flex items-center gap-2 py-1 px-1.5">
                                <span className="text-f1-muted font-mono text-xs w-4 shrink-0">{pos}</span>
                                <span className="text-f1-muted flex-1">{driverId ? driverName(driverId) : '–'}</span>
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
