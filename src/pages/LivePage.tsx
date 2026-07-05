import { useState, useEffect, useMemo } from 'react'
import { subscribeToEvents, getDrivers, subscribeToAllScores, getUsers, subscribeToEventTips } from '../lib/firestore'
import { openf1, findOpenF1Session } from '../lib/openf1'
import type { OpenF1Weather, OpenF1RaceControl, OpenF1Stint, OpenF1Pit } from '../lib/openf1'
import { processSessionResults, processPositions } from '../lib/resultProcessing'
import { jolpicaResults } from '../lib/jolpica'
import { getTeamColor } from '../lib/teamColors'
import { CountdownTimer } from '../components/CountdownTimer'
import { useAuth } from '../contexts/AuthContext'
import type { F1Event, Driver, DriverResult, TippableSessionType, SessionInfo, Score, AppUser, Tip } from '../types'

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying', race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying', sprint_race: 'Sprint Race',
}

const INTERESTING_CATEGORIES = new Set([
  'Flag', 'SafetyCar', 'VirtualSafetyCar', 'RedFlag',
  'Incident', 'Investigation', 'Penalty', 'DRS',
])

const FLAG_CONFIG: Record<string, { label: string; className: string }> = {
  'GREEN':               { label: 'Grüne Flagge',      className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  'YELLOW':              { label: 'Gelbe Flagge',      className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  'RED':                 { label: 'Rote Flagge',       className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'CHEQUERED':           { label: 'Zielflagge',        className: 'bg-white/10 text-white border-white/20' },
  'SAFETY CAR':          { label: 'Safety Car',        className: 'bg-yellow-400/15 text-yellow-200 border-yellow-400/30' },
  'VIRTUAL SAFETY CAR':  { label: 'Virtual Safety Car', className: 'bg-yellow-300/10 text-yellow-100 border-yellow-300/20' },
}

const FLAG_DOTS: Record<string, string> = {
  'GREEN': 'bg-green-500', 'YELLOW': 'bg-yellow-400', 'RED': 'bg-red-500',
  'CHEQUERED': 'bg-white', 'SAFETY CAR': 'bg-yellow-300', 'VIRTUAL SAFETY CAR': 'bg-yellow-200',
}

const COMPOUND_STYLE: Record<string, string> = {
  S: 'bg-red-600 text-white', M: 'bg-yellow-400 text-black',
  H: 'bg-gray-300 text-black', I: 'bg-green-500 text-white', W: 'bg-blue-400 text-white',
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

const REVIEW_WINDOW_MS = 12 * 3_600_000

function TipsCard({ users, sessionTips, driverTeamMap, driverName }: {
  users: AppUser[]
  sessionTips: Tip[]
  driverTeamMap: Map<string, string>
  driverName: (id: string) => string
}) {
  if (sessionTips.length === 0) return null
  return (
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
                        <span className="text-f1-muted text-xs flex-1 truncate">{driverName(driverId)}</span>
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
  )
}

function SeasonCard({ tipScores }: { tipScores: { user: AppUser; total: number }[] }) {
  if (tipScores.length === 0) return null
  return (
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
  )
}

export function LivePage() {
  const { user: authUser } = useAuth()
  const [events, setEvents] = useState<F1Event[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  const [weather, setWeather] = useState<OpenF1Weather | null>(null)
  const [weatherFetched, setWeatherFetched] = useState(false)
  const [raceControl, setRaceControl] = useState<OpenF1RaceControl[]>([])
  const [stints, setStints] = useState<OpenF1Stint[]>([])
  const [pits, setPits] = useState<OpenF1Pit[]>([])
  const [finalPositions, setFinalPositions] = useState<DriverResult[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
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
    const t = setInterval(() => setTick(n => n + 1), 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  const now = new Date()
  void tick

  // Detect active (in progress) session
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

  // Detect recently ended session (within last 12h) — only if no active session
  let reviewEvent: F1Event | null = null
  let reviewSessionType: TippableSessionType | null = null
  let reviewSessionInfo: SessionInfo | null = null
  if (!activeEvent) {
    for (const event of events) {
      const sessionTypes: TippableSessionType[] = event.isSprintWeekend
        ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
        : ['qualifying', 'race']
      for (const st of sessionTypes) {
        const infoKey = TIPPABLE_TO_EVENT_SESSION[st]
        const info = event.sessions[infoKey]
        if (!info) continue
        const endTime = info.endTime.toDate()
        if (endTime <= now && now.getTime() - endTime.getTime() < REVIEW_WINDOW_MS) {
          if (!reviewSessionInfo || endTime > reviewSessionInfo.endTime.toDate()) {
            reviewEvent = event
            reviewSessionType = st
            reviewSessionInfo = info
          }
        }
      }
    }
  }

  const currentEvent = activeEvent ?? reviewEvent
  const currentSessionType = activeSessionType ?? reviewSessionType
  const currentSessionInfo = activeSessionInfo ?? reviewSessionInfo
  const isInProgress = !!activeEvent

  useEffect(() => {
    if (!currentEvent) return
    const year = parseInt(currentEvent.id.split('_').pop() ?? '2026')
    getDrivers(year).then(setDrivers).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id])

  useEffect(() => {
    if (!currentEvent) { setTips([]); return }
    return subscribeToEventTips(currentEvent.id, setTips)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id])

  useEffect(() => {
    if (!currentEvent || !currentSessionInfo) { setSessionKey(null); return }
    const year = parseInt(currentEvent.id.split('_').pop() ?? '2026')
    const startTime = currentSessionInfo.startTime.toDate()
    openf1.sessions(year)
      .then(sessions => {
        const key = findOpenF1Session(sessions, startTime)
        if (key) setSessionKey(key)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id, currentSessionType])

  // Load historical data once after session ends
  useEffect(() => {
    if (!sessionKey || isInProgress || drivers.length === 0) {
      setWeather(null)
      setWeatherFetched(false)
      setRaceControl([])
      setStints([])
      setPits([])
      setFinalPositions([])
      setDataLoaded(false)
      return
    }
    const key = sessionKey
    const event = reviewEvent
    const st = reviewSessionType
    const year = parseInt((event?.id ?? '2026').split('_').pop() ?? '2026')
    const driverByNumber = new Map(drivers.map(d => [d.number, d]))
    let cancelled = false

    async function loadData() {
      const [wRes, rcRes, pitRes, stintRes, srRes] = await Promise.allSettled([
        openf1.weather(key),
        openf1.raceControl(key),
        openf1.pits(key),
        openf1.stints(key),
        openf1.sessionResults(key),
      ])
      if (cancelled) return

      if (wRes.status === 'fulfilled' && wRes.value.length > 0)
        setWeather(wRes.value[wRes.value.length - 1])
      setWeatherFetched(true)

      if (rcRes.status === 'fulfilled')
        setRaceControl([...rcRes.value].filter(m => INTERESTING_CATEGORIES.has(m.category)).reverse())

      if (pitRes.status === 'fulfilled')
        setPits([...pitRes.value].sort((a, b) => b.lap_number - a.lap_number))

      if (stintRes.status === 'fulfilled')
        setStints(stintRes.value)

      let positions: DriverResult[] = []
      if (srRes.status === 'fulfilled' && srRes.value.length > 0)
        positions = processSessionResults(srRes.value, driverByNumber)

      if (positions.length === 0) {
        try {
          const posData = await openf1.positions(key)
          positions = processPositions(posData, driverByNumber)
        } catch {}
      }

      if (positions.length === 0 && event?.round && st) {
        positions = await jolpicaResults(st, year, event.round, driverByNumber)
      }

      if (!cancelled) {
        setFinalPositions(positions)
        setDataLoaded(true)
      }
    }
    void loadData()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, isInProgress, drivers.length])

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

  const currentFlag = raceControl.find(m => m.flag)?.flag ?? null
  const flagConfig = currentFlag ? (FLAG_CONFIG[currentFlag] ?? null) : null
  const flagDot = currentFlag ? (FLAG_DOTS[currentFlag] ?? 'bg-gray-500') : 'bg-gray-400'

  const sessionTips = tips.filter(t => t.sessionType === currentSessionType)
  const driverName = (id: string) => drivers.find(d => d.id === id)?.name ?? id
  const driverTeamMap = useMemo(() => new Map(drivers.map(d => [d.id, d.team])), [drivers])

  const tipScores = useMemo(() => {
    const totals = users.map(u => ({
      user: u,
      total: scores.filter(s => s.userId === u.id).reduce((sum, s) => sum + s.points, 0),
    })).sort((a, b) => b.total - a.total)
    const me = totals.find(t => t.user.id === authUser?.id)
    const rest = totals.filter(t => t.user.id !== authUser?.id)
    return me ? [me, ...rest] : totals
  }, [users, scores, authUser?.id])

  // ── No active / recent session ────────────────────────────────────────────
  if (!currentEvent || !currentSessionType) {
    const upcoming: { event: F1Event; st: TippableSessionType; info: SessionInfo }[] = []
    for (const event of events) {
      const sessionTypes: TippableSessionType[] = event.isSprintWeekend
        ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
        : ['qualifying', 'race']
      for (const st of sessionTypes) {
        const infoKey = TIPPABLE_TO_EVENT_SESSION[st]
        const info = event.sessions[infoKey]
        if (info && info.startTime.toDate() > now) upcoming.push({ event, st, info })
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
        <SeasonCard tipScores={tipScores} />
      </div>
    )
  }

  // ── Session in progress ───────────────────────────────────────────────────
  if (isInProgress && activeSessionInfo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black uppercase tracking-tight">{currentEvent.name}</h1>
            <span className="flex items-center gap-1.5 text-xs font-bold text-f1-red uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-f1-muted text-sm">{currentEvent.circuit} · {SESSION_LABELS[currentSessionType]}</p>
        </div>

        <div className="card mb-4">
          <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-2">Session läuft</p>
          <p className="text-f1-muted text-sm mb-4">Ergebnisse nach Session-Ende verfügbar</p>
          <CountdownTimer target={activeSessionInfo.endTime} label="Ende in" />
        </div>

        <TipsCard users={users} sessionTips={sessionTips} driverTeamMap={driverTeamMap} driverName={driverName} />
        <SeasonCard tipScores={tipScores} />
      </div>
    )
  }

  // ── Session review (recently ended) ──────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{currentEvent.name}</h1>
        <p className="text-f1-muted text-sm">{currentEvent.circuit} · {SESSION_LABELS[currentSessionType!]} · Session-Review</p>
      </div>

      {/* Weather + last flag */}
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
          <p className="text-f1-muted text-sm mb-3">{weatherFetched ? 'Keine Wetterdaten' : 'Wetterdaten laden…'}</p>
        )}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${flagDot}`} />
          {flagConfig ? (
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${flagConfig.className}`}>
              {flagConfig.label}
            </span>
          ) : (
            <span className="text-xs text-f1-muted font-bold uppercase tracking-wider">Session beendet</span>
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
                  <span className="text-f1-muted font-mono text-xs w-14 shrink-0 pt-0.5">Runde {m.lap_number}</span>
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
                  <span className="font-mono text-xs w-8 shrink-0"
                        style={{ color: driver ? getTeamColor(driver.team) : undefined }}>
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

      {/* Final Positions */}
      <div className="card mb-4">
        <p className="text-f1-muted text-xs font-bold uppercase tracking-widest mb-3">Ergebnis</p>
        {!dataLoaded ? (
          <p className="text-f1-muted text-sm">Lade Ergebnisse…</p>
        ) : finalPositions.length === 0 ? (
          <p className="text-f1-muted text-sm">Ergebnisse noch nicht verfügbar</p>
        ) : (
          <div className="space-y-0.5">
            {finalPositions.slice(0, 10).map(dr => {
              const driver = drivers.find(d => d.id === dr.driverId)
              const driverNum = driver?.number
              const compound = driverNum != null ? currentStints.get(driverNum) : null
              return (
                <div key={dr.driverId} className="flex items-center gap-2 py-1.5 px-1 text-sm">
                  <span className="text-f1-muted font-mono text-xs w-5 shrink-0 text-right">{dr.position}</span>
                  {compound
                    ? <CompoundBadge compound={compound} />
                    : <span className="w-[18px] shrink-0" />}
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: getTeamColor(driver?.team ?? '') }} />
                  <span className="font-mono text-xs w-8 shrink-0 text-f1-red">{dr.driverCode}</span>
                  <span className="text-white flex-1 text-xs">{dr.driverName}</span>
                  {(dr.dnf || dr.dns || dr.dsq) && (
                    <span className="text-f1-muted font-mono text-xs shrink-0">
                      {dr.dsq ? 'DSQ' : dr.dns ? 'DNS' : 'DNF'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TipsCard users={users} sessionTips={sessionTips} driverTeamMap={driverTeamMap} driverName={driverName} />
      <SeasonCard tipScores={tipScores} />
    </div>
  )
}
