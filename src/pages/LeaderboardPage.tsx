import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToAllScores, getUsers, subscribeToEvents, subscribeToAllTips, getDrivers } from '../lib/firestore'
import { TIPPABLE_TO_EVENT_SESSION } from '../lib/useLivePositions'
import { getTeamColor } from '../lib/teamColors'
import { useAuth } from '../contexts/AuthContext'
import type { Score, AppUser, F1Event, Tip, Driver, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying', sprint_race: 'Sprint Race',
}

const SESSION_ORDER: TippableSessionType[] = ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']

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
  const [tips, setTips] = useState<Tip[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])

  useEffect(() => {
    getUsers().then(setUsers)
    getDrivers(new Date().getFullYear()).then(setDrivers)
    const unsubScores = subscribeToAllScores(setScores)
    const unsubEvents = subscribeToEvents(setEvents)
    const unsubTips = subscribeToAllTips(setTips)
    return () => { unsubScores(); unsubEvents(); unsubTips() }
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

  const driverName = (id: string) => drivers.find(d => d.id === id)?.name ?? id
  const driverTeamMap = useMemo(() => new Map(drivers.map(d => [d.id, d.team])), [drivers])

  // Events mit Tips oder Scores, neueste zuerst
  const activeEvents = [...events]
    .filter(e => tips.some(t => t.eventId === e.id) || scores.some(s => s.eventId === e.id))
    .sort((a, b) => b.round - a.round)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rangliste</h1>

      <div className="card mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider">Gesamtpunkte</h2>
          {(() => {
            const latestCalc = scores.reduce<Date | null>((max, s) => {
              const d = s.calculatedAt.toDate()
              return !max || d > max ? d : max
            }, null)
            return latestCalc ? (
              <span className="text-f1-muted text-xs">
                Stand: {latestCalc.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            ) : null
          })()}</div>
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
        {scores.some(s => s.isProvisional) && (
          <p className="text-f1-muted text-xs mt-3">* Enthält vorläufige Ergebnisse</p>
        )}
      </div>

      {users.length === 2 && sorted.length === 2 && (() => {
        const me = sorted.find(s => s.user.id === user?.id) ?? sorted[0]
        const opponent = sorted.find(s => s.user.id !== user?.id) ?? sorted[1]
        return (
          <div className="card mb-8">
            <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Direktvergleich</h2>
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
                <p className="text-f1-muted text-xs">Unentschieden</p>
              </div>
              <div>
                <p className="text-xl font-bold text-f1-green">{opponent.sessionWins}</p>
                <p className="text-f1-muted text-xs">Siege</p>
              </div>
            </div>
          </div>
        )
      })()}

      {activeEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-3">Events</h2>
          <div className="flex flex-col gap-4">
            {activeEvents.map(event => {
              const tippableTypes = event.isSprintWeekend
                ? SESSION_ORDER
                : SESSION_ORDER.filter(st => st === 'qualifying' || st === 'race')

              const visibleSessions = tippableTypes.filter(st => {
                const infoKey = TIPPABLE_TO_EVENT_SESSION[st]
                const sessionInfo = event.sessions[infoKey]
                if (!sessionInfo || sessionInfo.startTime.toDate() > now) return false
                return tips.some(t => t.eventId === event.id && t.sessionType === st)
              })

              if (visibleSessions.length === 0) return null

              return (
                <div key={event.id} className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-f1-muted font-mono text-sm w-6">R{event.round}</span>
                    <span className="font-bold text-sm uppercase tracking-tight">{event.name}</span>
                    {event.isSprintWeekend && <span className="badge bg-f1-red text-white text-xs">S</span>}
                  </div>

                  <div className="space-y-5">
                    {visibleSessions.map(st => {
                      const sessionTips = tips.filter(t => t.eventId === event.id && t.sessionType === st)
                      const sessionScores = scores.filter(s => s.eventId === event.id && s.sessionType === st)

                      return (
                        <div key={st}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-f1-muted text-xs font-bold uppercase tracking-widest">
                              {SESSION_LABELS[st]}
                            </span>
                            {sessionScores.length > 0 && (
                              <div className="flex gap-4">
                                {users.map(u => {
                                  const sc = sessionScores.find(s => s.userId === u.id)
                                  return sc ? (
                                    <span key={u.id} className="text-xs font-bold text-f1-red">
                                      {u.displayName} {sc.points} Pkt
                                    </span>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {users.map(u => {
                              const tip = sessionTips.find(t => t.userId === u.id)
                              return (
                                <div key={u.id}>
                                  <p className="text-xs text-f1-muted mb-1">{u.displayName}</p>
                                  {tip ? (
                                    <div className="space-y-0.5">
                                      {Object.entries(tip.predictions)
                                        .sort(([a], [b]) => Number(a) - Number(b))
                                        .map(([pos, driverId]) => (
                                          <div key={pos} className="flex items-center gap-1.5 text-xs py-0.5">
                                            <span className="text-f1-muted font-mono w-4 shrink-0">{pos}</span>
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                                  style={{ backgroundColor: getTeamColor(driverTeamMap.get(driverId) ?? '') }} />
                                            <span className="text-f1-muted truncate">{driverName(driverId)}</span>
                                          </div>
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-f1-muted text-xs">Kein Tipp</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {scores.some(s => s.eventId === event.id) && (
                    <Link to={`/history/${event.id}`}
                      className="mt-4 text-xs text-f1-muted hover:text-white transition-colors block text-right">
                      Details →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
