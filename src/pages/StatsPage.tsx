import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { subscribeToAllScores, subscribeToEvents, getUsers, getDrivers } from '../lib/firestore'
import { useAuth } from '../contexts/AuthContext'
import type { Score, AppUser, F1Event, Driver, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Q', sprint_race: 'Sprint Race',
}
const SESSION_ORDER: Record<string, number> = {
  sprint_qualifying: 0, sprint_race: 1, qualifying: 2, race: 3,
}
const USER_COLORS = ['#E8002D', '#00D2BE'] // f1-red, f1-green

export function StatsPage() {
  const { user: authUser } = useAuth()
  const [scores, setScores] = useState<Score[]>([])
  const [events, setEvents] = useState<F1Event[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])

  useEffect(() => {
    getUsers().then(u => {
      setUsers(u)
      if (u.length > 0) {
        const year = new Date().getFullYear()
        getDrivers(year).then(setDrivers).catch(() => {})
      }
    })
    const unsubScores = subscribeToAllScores(setScores)
    const unsubEvents = subscribeToEvents(setEvents)
    return () => { unsubScores(); unsubEvents() }
  }, [])

  // Sort: current user first
  const sortedUsers = useMemo(() => {
    const me = users.find(u => u.id === authUser?.id)
    const rest = users.filter(u => u.id !== authUser?.id)
    return me ? [me, ...rest] : users
  }, [users, authUser?.id])

  const driverMap = useMemo(() => new Map(drivers.map(d => [d.id, d])), [drivers])

  // ── #4 Trefferquoten ────────────────────────────────────────────────────────

  const accuracy = useMemo(() => {
    return sortedUsers.map(user => {
      let exact = 0, partial = 0, miss = 0
      for (const s of scores.filter(s => s.userId === user.id)) {
        for (const b of s.breakdown) {
          if (!b.predictedDriverId) { miss++; continue }
          if (b.points === 3) exact++
          else if (b.points === 1) partial++
          else miss++
        }
      }
      const total = exact + partial + miss
      return { user, exact, partial, miss, total }
    })
  }, [scores, sortedUsers])

  // ── #7 Saison-Verlauf ───────────────────────────────────────────────────────

  const trendData = useMemo(() => {
    const pointsPerEvent: Record<string, Record<string, number>> = {}
    for (const s of scores) {
      if (!pointsPerEvent[s.eventId]) pointsPerEvent[s.eventId] = {}
      pointsPerEvent[s.eventId][s.userId] = (pointsPerEvent[s.eventId][s.userId] ?? 0) + s.points
    }
    const relevantEvents = events
      .filter(e => pointsPerEvent[e.id])
      .sort((a, b) => a.round - b.round)

    const cumulative: Record<string, number> = {}
    return relevantEvents.map(event => {
      const pts = pointsPerEvent[event.id] ?? {}
      for (const u of sortedUsers) {
        cumulative[u.id] = (cumulative[u.id] ?? 0) + (pts[u.id] ?? 0)
      }
      return {
        label: `R${event.round}`,
        name: event.name,
        ...sortedUsers.reduce((acc, u) => ({ ...acc, [u.id]: cumulative[u.id] ?? 0 }), {} as Record<string, number>),
      }
    })
  }, [scores, events, sortedUsers])

  // ── #9 H2H Session-Tabelle ──────────────────────────────────────────────────

  const h2hRows = useMemo(() => {
    const pairs = [...new Set(scores.map(s => `${s.eventId}||${s.sessionType}`))]
      .map(key => {
        const idx = key.indexOf('||')
        return { eventId: key.slice(0, idx), sessionType: key.slice(idx + 2) as TippableSessionType }
      })
    return pairs
      .map(({ eventId, sessionType }) => {
        const event = events.find(e => e.id === eventId)
        const sessionScores = scores.filter(s => s.eventId === eventId && s.sessionType === sessionType)
        return { event, sessionType, sessionScores }
      })
      .filter(r => r.event && r.sessionScores.length === 2)
      .sort((a, b) => {
        const roundDiff = a.event!.round - b.event!.round
        return roundDiff !== 0 ? roundDiff : (SESSION_ORDER[a.sessionType] ?? 0) - (SESSION_ORDER[b.sessionType] ?? 0)
      })
  }, [scores, events])

  // H2H streak: longest consecutive session wins
  const streaks = useMemo(() => {
    const result: Record<string, number> = {}
    for (const u of sortedUsers) result[u.id] = 0
    let current: Record<string, number> = {}
    for (const u of sortedUsers) current[u.id] = 0

    for (const { sessionScores } of h2hRows) {
      const [a, b] = sessionScores
      if (!a || !b) continue
      for (const u of sortedUsers) {
        const myScore = sessionScores.find(s => s.userId === u.id)?.points ?? 0
        const oppScore = sessionScores.find(s => s.userId !== u.id)?.points ?? 0
        if (myScore > oppScore) {
          current[u.id] = (current[u.id] ?? 0) + 1
          result[u.id] = Math.max(result[u.id] ?? 0, current[u.id] ?? 0)
        } else {
          current[u.id] = 0
        }
      }
      void a; void b
    }
    return result
  }, [h2hRows, sortedUsers])

  // Best session
  const bestSessions = useMemo(() => {
    return sortedUsers.map(u => {
      const userScores = scores.filter(s => s.userId === u.id)
      if (userScores.length === 0) return { user: u, best: null }
      const best = userScores.reduce((max, s) => s.points > max.points ? s : max)
      const event = events.find(e => e.id === best.eventId)
      return { user: u, best, event }
    })
  }, [scores, events, sortedUsers])

  // ── #8 Fahrer-Profil ────────────────────────────────────────────────────────

  const driverProfiles = useMemo(() => {
    return sortedUsers.map(user => {
      const statsMap: Record<string, { tipped: number; hit: number }> = {}
      for (const s of scores.filter(s => s.userId === user.id)) {
        for (const b of s.breakdown) {
          if (!b.predictedDriverId) continue
          const entry = statsMap[b.predictedDriverId] ?? { tipped: 0, hit: 0 }
          entry.tipped++
          if (b.points > 0) entry.hit++
          statsMap[b.predictedDriverId] = entry
        }
      }
      const sorted = Object.entries(statsMap)
        .sort((a, b) => b[1].tipped - a[1].tipped)
        .slice(0, 5)
        .map(([driverId, stat]) => ({
          driver: driverMap.get(driverId),
          driverId,
          ...stat,
          hitRate: stat.tipped > 0 ? Math.round((stat.hit / stat.tipped) * 100) : 0,
        }))
      return { user, drivers: sorted }
    })
  }, [scores, sortedUsers, driverMap])

  const hasData = scores.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-tight mb-6">Statistiken</h1>

      {!hasData && (
        <div className="card text-center py-8">
          <p className="text-f1-muted text-sm">Noch keine Scores vorhanden</p>
        </div>
      )}

      {hasData && (
        <>
          {/* #4 Trefferquoten */}
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Trefferquoten</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accuracy.map(({ user, exact, partial, miss, total }, i) => (
                <div key={user.id}>
                  <p className="font-semibold text-sm mb-3">{user.displayName}</p>
                  {total === 0 ? (
                    <p className="text-f1-muted text-xs">Keine Daten</p>
                  ) : (
                    <div className="space-y-2">
                      <AccuracyBar
                        label="Exakt (3 Pkt)"
                        count={exact}
                        total={total}
                        color={i === 0 ? 'bg-f1-red' : 'bg-f1-green'}
                      />
                      <AccuracyBar
                        label="Top 10 (1 Pkt)"
                        count={partial}
                        total={total}
                        color="bg-f1-gold"
                      />
                      <AccuracyBar
                        label="Daneben (0 Pkt)"
                        count={miss}
                        total={total}
                        color="bg-f1-border"
                      />
                      <p className="text-f1-muted text-xs mt-1">{total} Vorhersagen</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* #7 Saison-Verlauf */}
          {trendData.length >= 2 && (
            <div className="card mb-6">
              <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Saison-Verlauf</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: '#2E2E3E' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: '#2E2E3E' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1E1E2E', border: '1px solid #2E2E3E', borderRadius: 4 }}
                    labelStyle={{ color: '#6B7280', fontSize: 11 }}
                    itemStyle={{ fontSize: 12 }}
                    formatter={(value, name) => {
                      const user = sortedUsers.find(u => u.id === String(name))
                      return [String(value) + ' Pkt', user?.displayName ?? String(name)]
                    }}
                    labelFormatter={(_, payload) => {
                      return payload?.[0]?.payload?.name ?? ''
                    }}
                  />
                  {sortedUsers.map((u, i) => (
                    <Line
                      key={u.id}
                      type="monotone"
                      dataKey={u.id}
                      stroke={USER_COLORS[i] ?? '#6B7280'}
                      strokeWidth={2}
                      dot={{ fill: USER_COLORS[i] ?? '#6B7280', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {sortedUsers.map((u, i) => (
                  <span key={u.id} className="flex items-center gap-1.5 text-xs text-f1-muted">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: USER_COLORS[i] ?? '#6B7280' }} />
                    {u.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* #9 H2H Details */}
          {h2hRows.length > 0 && sortedUsers.length === 2 && (
            <div className="card mb-6">
              <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Direktvergleich · Sessions</h2>
              {/* Streak + Best */}
              <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-f1-border">
                {sortedUsers.map((u, i) => (
                  <div key={u.id} className="flex-1 min-w-0">
                    <p className="text-xs text-f1-muted mb-1">{u.displayName}</p>
                    <p className="text-sm">
                      <span className="font-bold" style={{ color: USER_COLORS[i] ?? '#fff' }}>
                        {streaks[u.id] ?? 0}
                      </span>
                      <span className="text-f1-muted text-xs ml-1">max. Siegesserie</span>
                    </p>
                    {bestSessions.find(b => b.user.id === u.id)?.best && (() => {
                      const bs = bestSessions.find(b => b.user.id === u.id)!
                      return (
                        <p className="text-xs text-f1-muted mt-0.5">
                          Bestes Ergebnis: <span className="text-white">{bs.best!.points} Pkt</span>
                          {bs.event && ` (${bs.event.name})`}
                        </p>
                      )
                    })()}
                  </div>
                ))}
              </div>
              {/* Session table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-f1-muted text-xs uppercase tracking-wide">
                      <th className="text-left py-1.5 font-normal w-6">R</th>
                      <th className="text-left py-1.5 font-normal">Event</th>
                      <th className="text-left py-1.5 font-normal hidden sm:table-cell">Session</th>
                      <th className="text-right py-1.5 font-normal">{sortedUsers[0]?.displayName}</th>
                      <th className="text-right py-1.5 font-normal">{sortedUsers[1]?.displayName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2hRows.map(({ event, sessionType, sessionScores }, idx) => {
                      const scoreA = sessionScores.find(s => s.userId === sortedUsers[0]?.id)?.points ?? 0
                      const scoreB = sessionScores.find(s => s.userId === sortedUsers[1]?.id)?.points ?? 0
                      const aWins = scoreA > scoreB
                      const bWins = scoreB > scoreA
                      return (
                        <tr key={idx} className="border-t border-f1-border/50">
                          <td className="py-1.5 text-f1-muted font-mono text-xs">{event!.round}</td>
                          <td className="py-1.5 text-xs text-f1-muted max-w-[120px] truncate">{event!.name.replace(' Grand Prix', '')}</td>
                          <td className="py-1.5 text-xs text-f1-muted hidden sm:table-cell">{SESSION_LABELS[sessionType]}</td>
                          <td className={`py-1.5 text-right font-bold text-sm ${aWins ? 'text-white' : 'text-f1-muted'}`}>{scoreA}</td>
                          <td className={`py-1.5 text-right font-bold text-sm ${bWins ? 'text-white' : 'text-f1-muted'}`}>{scoreB}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* #8 Fahrer-Profil */}
          <div className="card">
            <h2 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-4">Fahrer-Prognose</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {driverProfiles.map(({ user, drivers: topDrivers }) => (
                <div key={user.id}>
                  <p className="font-semibold text-sm mb-3">{user.displayName}</p>
                  {topDrivers.length === 0 ? (
                    <p className="text-f1-muted text-xs">Keine Daten</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topDrivers.map(({ driver, driverId, tipped, hitRate }) => (
                        <div key={driverId} className="flex items-center gap-2 text-sm">
                          <span className="text-f1-red font-mono text-xs w-8 shrink-0">
                            {driver?.code ?? driverId.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="text-f1-muted text-xs flex-1 truncate">
                            {driver?.name ?? driverId}
                          </span>
                          <span className="text-f1-muted text-xs shrink-0">{tipped}×</span>
                          <span className={`text-xs font-bold shrink-0 w-10 text-right ${hitRate >= 50 ? 'text-f1-green' : hitRate >= 30 ? 'text-f1-gold' : 'text-f1-muted'}`}>
                            {hitRate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AccuracyBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-f1-muted">{label}</span>
        <span className="text-white font-medium">{pct}% <span className="text-f1-muted font-normal">({count})</span></span>
      </div>
      <div className="h-1.5 bg-f1-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
