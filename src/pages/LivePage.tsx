import { useState, useEffect, useMemo } from 'react'
import { subscribeToEvents, getDrivers, subscribeToAllScores, getUsers, subscribeToEventTips } from '../lib/firestore'
import { openf1, findOpenF1Session } from '../lib/openf1'
import type { OpenF1Weather, OpenF1RaceControl, OpenF1Interval, OpenF1Stint, OpenF1Pit } from '../lib/openf1'
import { TIPPABLE_TO_EVENT_SESSION, useLivePositions } from '../lib/useLivePositions'
import { getTeamColor } from '../lib/teamColors'
import { CountdownTimer } from '../components/CountdownTimer'
import { useAuth } from '../contexts/AuthContext'
import type { F1Event, Driver, TippableSessionType, SessionInfo, Score, AppUser, Tip } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying', sprint_race: 'Sprint Race',
}

const INTERESTING_CATEGORIES = new Set([
  'Flag', 'SafetyCar', 'VirtualSafetyCar', 'RedFlag',
  'Incident', 'Investigation', 'Penalty', 'DRS',
])

const FLAG_CONFIG: Record<string, { label: string; className: string }> = {
  'GREEN':       { label: 'Grüne Flagge',    className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  'YELLOW':      { label: 'Gelbe Flagge',    className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  'RED':         { label: 'Rote Flagge',     className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'CHEQUERED':   { label: 'Zielflagge',      className: 'bg-white/10 text-white border-white/20' },
  'SAFETY CAR':  { label: 'Safety Car',      className: 'bg-yellow-400/15 text-yellow-200 border-yellow-400/30' },
  'VIRTUAL SAFETY CAR': { label: 'Virtual Safety Car', className: 'bg-yellow-300/10 text-yellow-100 border-yellow-300/20' },
}

const FLAG_DOTS: Record<string, string> = {
  'GREEN': 'bg-green-500',
  'YELLOW': 'bg-yellow-400',
  'RED': 'bg-red-500',
  'CHEQUERED': 'bg-white',
  'SAFETY CAR': 'bg-yellow-300',
  'VIRTUAL SAFETY CAR': 'bg-yellow-200',
}

const COMPOUND_STYLE: Record<string, string> = {
  S: 'bg-red-600 text-white',
  M: 'bg-yellow-400 text-black',
  H: 'bg-gray-300 text-black',
  I: 'bg-green-500 text-white',
  W: 'bg-blue-400 text-white',
}

function CompoundBadge({ compound }: { compound: string }) {
  const key = (compound[0] ?? '?').toUpperCase()
  return (
    <span
      title={compound}
      className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-black shrink-0 ${COMPOUND_STYLE[key] ?? 'bg-f1-border text-f1-muted'}`}
    >
      {key}
    </span>
  )
}

function formatGap(gap: number | string | null | undefined, isLeader: boolean): string {
  if (isLeader) return '—'
  if (gap === null || gap === undefined) return ''
  if (typeof gap === 'string') return gap
  if (gap === 0) return '—'
  if (gap < 60) return `+${gap.toFixed(1)}s`
  return `+${Math.floor(gap / 60)}:${String(Math.floor(gap % 60)).padStart(2, '0')}`
}

export function LivePage() {
  const { user: authUser } = useAuth()
  const [events, setEvents] = useState<F1Event[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  const [weather, setWeather] = useState<OpenF1Weather | null>(null)
  const [raceControl, setRaceControl] = useState<OpenF1RaceControl[]>([])
  const [intervals, setIntervals] = useState<OpenF1Interval[]>([])
  const [stints, setStints] = useState<OpenF1Stint[]>([])
  const [pits, setPits] = useState<OpenF1Pit[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => subscribeToEvents(setEvents), [])
  useEffect(() => {
    getUsers().then(setUsers)
    return subscribeToAllScores(setScores)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const now = new Date()

  // Detect active tippable session
  let activeEvent: F1Event | null = null
  let activeSessionType: TippableSessionType | null = null
  let activeSessionInfo: SessionInfo | null = null
  outer: for (const event of events) {
    const sessionTypes: TippableSessionType[] = event.isSprintWeekend
      ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
      : ['qualifying', 'race']
    for (const st of sessionTypes) {
      const infoKey = TIPPABLE_TO_EVENT_SESSION[st]
      const info = event.sessions[infoKey]
      if (info && info.startTime.toDate() <= now && now < info.endTime.toDate()) {
        activeEvent = event
        activeSessionType = st
        activeSessionInfo = info
        break outer
      }
    }
  }

  useEffect(() => {
    if (!activeEvent) return
    const year = parseInt(activeEvent.id.split('_').pop() ?? '2026')
    getDrivers(year).then(setDrivers).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id])

  useEffect(() => {
    if (!activeEvent) { setTips([]); return }
    return subscribeToEventTips(activeEvent.id, setTips)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id])

  useEffect(() => {
    if (!activeEvent || !activeSessionType || !activeSessionInfo) {
      setSessionKey(null)
      return
    }
    const year = parseInt(activeEvent.id.split('_').pop() ?? '2026')
    const startTime = activeSessionInfo.startTime.toDate()
    openf1.sessions(year)
      .then(sessions => {
        const key = findOpenF1Session(sessions, startTime)
        if (key) setSessionKey(key)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id, activeSessionType])

  // Weather polling (60s)
  useEffect(() => {
    if (!sessionKey) { setWeather(null); return }
    let cancelled = false
    async function fetch() {
      if (cancelled) return
      try {
        const data = await openf1.weather(sessionKey!)
        if (!cancelled && data.length > 0) setWeather(data[data.length - 1])
      } catch {}
    }
    void fetch()
    const t = setInterval(() => void fetch(), 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sessionKey])

  // Race control polling (15s)
  useEffect(() => {
    if (!sessionKey) { setRaceControl([]); return }
    let cancelled = false
    async function fetch() {
      if (cancelled) return
      try {
        const data = await openf1.raceControl(sessionKey!)
        if (!cancelled) {
          setRaceControl(
            [...data]
              .filter(m => INTERESTING_CATEGORIES.has(m.category))
              .reverse()
          )
        }
      } catch {}
    }
    void fetch()
    const t = setInterval(() => void fetch(), 15_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sessionKey])

  // Intervals + pits polling (15s)
  useEffect(() => {
    if (!sessionKey) { setIntervals([]); setPits([]); return }
    let cancelled = false
    async function fetch() {
      if (cancelled) return
      try {
        const [ivData, pitData] = await Promise.all([
          openf1.intervals(sessionKey!),
          openf1.pits(sessionKey!),
        ])
        if (!cancelled) {
          setIntervals(ivData)
          setPits([...pitData].sort((a, b) => b.lap_number - a.lap_number))
        }
      } catch {}
    }
    void fetch()
    const t = setInterval(() => void fetch(), 15_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sessionKey])

  // Stints polling (30s)
  useEffect(() => {
    if (!sessionKey) { setStints([]); return }
    let cancelled = false
    async function fetch() {
      if (cancelled) return
      try {
        const data = await openf1.stints(sessionKey!)
        if (!cancelled) setStints(data)
      } catch {}
    }
    void fetch()
    const t = setInterval(() => void fetch(), 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sessionKey])

  // Live positions
  const livePositions = useLivePositions(activeEvent, activeSessionType ?? 'race', drivers)

  // Derive current flag from most recent race control entry with a flag
  const currentFlag = raceControl.find(m => m.flag)?.flag ?? null
  const flagConfig = currentFlag ? (FLAG_CONFIG[currentFlag] ?? null) : null
  const flagDot = currentFlag ? (FLAG_DOTS[currentFlag] ?? 'bg-gray-500') : 'bg-green-500'

  // Current compound per driver (latest stint by stint_number)
  const currentStints = useMemo(() => {
    const latest = new Map<number, OpenF1Stint>()
    for (const s of stints) {
      const ex = latest.get(s.driver_number)
      if (!ex || s.stint_number > ex.stint_number) latest.set(s.driver_number, s)
    }
    const map = new Map<number, string>()
    for (const [num, s] of latest) map.set(num, s.compound)
    return map
  }, [stints])

  // Latest gap_to_leader per driver
  const gapToLeader = useMemo(() => {
    const latest = new Map<number, OpenF1Interval>()
    for (const iv of intervals) {
      const ex = latest.get(iv.driver_number)
      if (!ex || iv.date > ex.date) latest.set(iv.driver_number, iv)
    }
    const map = new Map<number, number | string | null>()
    for (const [num, iv] of latest) map.set(num, iv.gap_to_leader)
    return map
  }, [intervals])

  // Lap count from race control messages
  const lapCount = raceControl.reduce<number | null>((max, m) =>
    m.lap_number ? Math.max(max ?? 0, m.lap_number) : max, null)

  // Tips for active session
  const sessionTips = tips.filter(t => t.sessionType === activeSessionType)
  const driverName = (id: string) => drivers.find(d => d.id === id)?.name ?? id
  const driverTeamMap = useMemo(() => new Map(drivers.map(d => [d.id, d.team])), [drivers])

  // Tipping season totals
  const tipScores = useMemo(() => {
    const totals = users.map(u => ({
      user: u,
      total: scores.filter(s => s.userId === u.id).reduce((sum, s) => sum + s.points, 0),
    })).sort((a, b) => b.total - a.total)
    const me = totals.find(t => t.user.id === authUser?.id)
    const rest = totals.filter(t => t.user.id !== authUser?.id)
    return me ? [me, ...rest] : totals
  }, [users, scores, authUser?.id])

  void tick

  // ── No active session ──────────────────────────────────────────────────────

  if (!activeEvent || !activeSessionType) {
    const upcoming: { event: F1Event; st: TippableSessionType; info: SessionInfo }[] = []
    for (const event of events) {
      const sessionTypes: TippableSessionType[] = event.isSprintWeekend
        ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
        : ['qualifying', 'race']
      for (const st of sessionTypes) {
        const infoKey = TIPPABLE_TO_EVENT_SESSION[st]
        const info = event.sessions[infoKey]
        if (info && info.startTime.toDate() > now) {
          upcoming.push({ event, st, info })
        }
      }
    }
    upcoming.sort((a, b) => a.info.startTime.toDate().getTime() - b.info.startTime.toDate().getTime())
    const next = upcoming[0] ?? null

    return (
      <div className="max-w-lg mx-auto pt-8 text-center">
        <div className="card mb-4">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-4">Live</p>
          <p className="text-xl font-black uppercase tracking-tight mb-6">Kein aktives Rennen</p>
          {next ? (
            <div>
              <p className="text-f1-muted text-sm mb-1 uppercase tracking-wide">Nächste Session</p>
              <p className="font-bold text-sm mb-1">{SESSION_LABELS[next.st]} — {next.event.name}</p>
              <p className="text-f1-muted text-xs mb-4">{next.event.circuit}</p>
              <CountdownTimer target={next.info.startTime} label="Startet in" />
            </div>
          ) : (
            <p className="text-f1-muted text-sm">Keine weiteren Sessions in dieser Saison</p>
          )}
        </div>
        {tipScores.length > 0 && (
          <div className="card text-left">
            <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Tipps · Saisonstand</p>
            <div className="flex gap-8">
              {tipScores.map((t, i) => (
                <div key={t.user.id}>
                  <p className="text-f1-muted text-xs mb-0.5">{t.user.displayName}</p>
                  <p className="text-2xl font-black" style={{ color: i === 0 ? '#E8002D' : '#00D2BE' }}>{t.total}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active session ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-black uppercase tracking-tight">{activeEvent.name}</h1>
          <span className="flex items-center gap-1.5 text-xs font-bold text-f1-red uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse" />
            Live
          </span>
        </div>
        <p className="text-f1-muted text-sm">
          {activeEvent.circuit} · {SESSION_LABELS[activeSessionType]}
          {lapCount ? ` · Runde ${lapCount}` : ''}
        </p>
      </div>

      {/* Weather + Flag row */}
      <div className="card mb-4">
        {weather ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
            <span className="text-f1-muted">Luft <span className="text-white font-medium">{Math.round(weather.air_temp)}°C</span></span>
            <span className="text-f1-muted">Strecke <span className="text-white font-medium">{Math.round(weather.track_temp)}°C</span></span>
            <span className="text-f1-muted">Feucht. <span className="text-white font-medium">{Math.round(weather.humidity)}%</span></span>
            <span className="text-f1-muted">Wind <span className="text-white font-medium">{Math.round(weather.wind_speed)} km/h</span></span>
            <span className={`font-medium ${weather.rainfall ? 'text-blue-400' : 'text-f1-muted'}`}>
              {weather.rainfall ? 'Regen' : 'Trocken'}
            </span>
          </div>
        ) : (
          <p className="text-f1-muted text-sm mb-3">Wetterdaten laden…</p>
        )}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${flagDot}`} />
          {flagConfig ? (
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${flagConfig.className}`}>
              {flagConfig.label}
            </span>
          ) : (
            <span className="text-xs text-green-400 font-bold uppercase tracking-wider">Session aktiv</span>
          )}
        </div>
      </div>

      {/* Race Control */}
      {raceControl.length > 0 && (
        <div className="card mb-4">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Race Control</p>
          <div className="space-y-1.5">
            {raceControl.slice(0, 6).map((m, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {m.lap_number != null && (
                  <span className="text-f1-muted font-mono text-xs w-14 shrink-0 pt-0.5">
                    Runde {m.lap_number}
                  </span>
                )}
                <span className="text-f1-muted flex-1 leading-snug">{m.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pit Stops */}
      {pits.length > 0 && (
        <div className="card mb-4">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Pit-Stopps</p>
          <div className="space-y-1.5">
            {pits.slice(0, 6).map((pit, i) => {
              const driver = drivers.find(d => d.number === pit.driver_number)
              const duration = pit.stop_duration ?? pit.pit_duration
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-f1-muted font-mono text-xs w-16 shrink-0">Rd. {pit.lap_number}</span>
                  <span
                    className="font-mono text-xs w-8 shrink-0"
                    style={{ color: driver ? getTeamColor(driver.team) : undefined }}
                  >
                    {driver?.code ?? `#${pit.driver_number}`}
                  </span>
                  <span className="text-f1-muted text-xs flex-1 truncate">{driver?.name ?? ''}</span>
                  {duration != null && (
                    <span className="text-white font-mono text-xs shrink-0">{duration.toFixed(1)}s</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Live Positions */}
      <div className="card mb-4">
        <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">
          Positionen · aktualisiert alle 15s
        </p>
        {livePositions.length === 0 ? (
          <p className="text-f1-muted text-sm">Lade Positionsdaten…</p>
        ) : (
          <div className="space-y-0.5">
            {livePositions.slice(0, 10).map(dr => {
              const driver = drivers.find(d => d.id === dr.driverId)
              const driverNum = driver?.number
              const compound = driverNum != null ? currentStints.get(driverNum) : null
              const gap = driverNum != null ? gapToLeader.get(driverNum) : null
              const isLeader = dr.position === 1
              return (
                <div key={dr.driverId} className="flex items-center gap-2 py-1.5 px-1 text-sm">
                  <span className="text-f1-muted font-mono text-xs w-5 shrink-0 text-right">{dr.position}</span>
                  {compound
                    ? <CompoundBadge compound={compound} />
                    : <span className="w-[18px] shrink-0" />}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: getTeamColor(driver?.team ?? '') }}
                  />
                  <span className="font-mono text-xs w-8 shrink-0 text-f1-red">{dr.driverCode}</span>
                  <span className="text-white flex-1 text-xs">{dr.driverName}</span>
                  <span className="text-f1-muted font-mono text-xs shrink-0 w-14 text-right">
                    {gap !== undefined ? formatGap(gap, isLeader) : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tips for active session */}
      {sessionTips.length > 0 && (
        <div className="card mb-4">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Tipps</p>
          <div className="grid grid-cols-2 gap-6">
            {users.map(user => {
              const tip = sessionTips.find(t => t.userId === user.id)
              return (
                <div key={user.id}>
                  <p className="font-semibold text-sm mb-2">{user.displayName}</p>
                  {tip ? (
                    <div className="space-y-0.5">
                      {Object.entries(tip.predictions)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([pos, driverId]) => (
                          <div key={pos} className="flex items-center gap-2 py-0.5 px-1">
                            <span className="text-f1-muted font-mono text-xs w-4 shrink-0">{pos}</span>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: getTeamColor(driverTeamMap.get(driverId) ?? '') }} />
                            <span className="text-f1-muted text-xs flex-1 truncate">
                              {driverName(driverId)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-f1-muted text-sm">Kein Tipp</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tipping season totals */}
      {tipScores.length > 0 && (
        <div className="card">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Tipps · Saisonstand</p>
          <div className="flex gap-8">
            {tipScores.map((t, i) => (
              <div key={t.user.id}>
                <p className="text-f1-muted text-xs mb-0.5">{t.user.displayName}</p>
                <p className="text-2xl font-black" style={{ color: i === 0 ? '#E8002D' : '#00D2BE' }}>{t.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
