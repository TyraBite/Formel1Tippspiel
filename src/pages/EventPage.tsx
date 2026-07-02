import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeToEvents, getDrivers } from '../lib/firestore'
import { useTips } from '../hooks/useTips'
import { useSessionResult } from '../hooks/useSessionResults'
import { usePracticePositions } from '../lib/usePracticePositions'
import { TipForm } from '../components/TipForm'
import { ReferenceTable } from '../components/ReferenceTable'
import { CountdownTimer } from '../components/CountdownTimer'
import type { F1Event, Driver, TippableSessionType, DriverResult } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race: 'Sprint Race',
}

interface RefInfo {
  results: DriverResult[] | null
  label: string
  isProvisional?: boolean
  isLoading?: boolean
}

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<F1Event | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [activeTab, setActiveTab] = useState<TippableSessionType>('qualifying')
  const [userPickedTab, setUserPickedTab] = useState(false)

  useEffect(() => {
    const unsub = subscribeToEvents(events => {
      setEvent(events.find(e => e.id === eventId) ?? null)
    })
    const year = parseInt(eventId?.match(/(\d{4})/)?.[1] ?? String(new Date().getFullYear()))
    getDrivers(year).then(setDrivers)
    return unsub
  }, [eventId])

  const { getTip, isLocked, submitTip, tipsLoaded } = useTips(event)

  // Firestore subscriptions for tippable session results
  const qualifyingResult  = useSessionResult(eventId, 'qualifying')
  const sprintQResult     = useSessionResult(eventId, 'sprint_qualifying')

  // OpenF1 practice session data (live or ended)
  const fp1Data = usePracticePositions(event, 'fp1', drivers)
  const fp2Data = usePracticePositions(event, 'fp2', drivers)
  const fp3Data = usePracticePositions(event, 'fp3_or_sprint_q', drivers)

  const tippableSessions: TippableSessionType[] = event?.isSprintWeekend
    ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
    : ['qualifying', 'race']

  useEffect(() => {
    if (userPickedTab || !tipsLoaded) return
    const untipped = tippableSessions.find(s => !getTip(s))
    setActiveTab(untipped ?? tippableSessions[tippableSessions.length - 1] ?? 'qualifying')
  }, [tipsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setUserPickedTab(false)
  }, [event?.id])

  const activeSessionInfo = (() => {
    if (!event) return null
    if (activeTab === 'qualifying') return event.sessions.qualifying
    if (activeTab === 'race') return event.sessions.race
    if (activeTab === 'sprint_race') return event.sessions.sprint_race ?? null
    if (activeTab === 'sprint_qualifying') return event.sessions.fp3_or_sprint_q ?? null
    return null
  })()

  if (!event) return <div className="text-f1-muted">Laden...</div>

  const now = new Date()

  function bestFP(): { results: DriverResult[]; label: string } | null {
    const fp3Ended = (event!.sessions.fp3_or_sprint_q?.endTime.toDate() ?? new Date(0)) <= now
    const fp2Ended = (event!.sessions.fp2?.endTime.toDate() ?? new Date(0)) <= now
    const fp1Ended = (event!.sessions.fp1?.endTime.toDate() ?? new Date(0)) <= now
    if (fp3Ended && fp3Data.status === 'loaded') return { results: fp3Data.positions, label: 'FP3 Ergebnis' }
    if (fp2Ended && fp2Data.status === 'loaded') return { results: fp2Data.positions, label: 'FP2 Ergebnis' }
    if (fp1Ended && fp1Data.status === 'loaded') return { results: fp1Data.positions, label: 'FP1 Ergebnis' }
    return null
  }

  const refInfo: RefInfo = (() => {
    if (activeTab === 'race') {
      return {
        results: qualifyingResult?.results ?? null,
        label: 'Qualifying Ergebnis',
        isProvisional: qualifyingResult?.status === 'provisional',
      }
    }
    if (activeTab === 'sprint_race') {
      return {
        results: sprintQResult?.results ?? null,
        label: 'Sprint Qualifying Ergebnis',
        isProvisional: sprintQResult?.status === 'provisional',
      }
    }
    if (activeTab === 'qualifying') {
      if (event.isSprintWeekend) {
        return {
          results: sprintQResult?.results ?? null,
          label: 'Sprint Qualifying Ergebnis',
          isProvisional: sprintQResult?.status === 'provisional',
        }
      }
      const fp = bestFP()
      const fpLoading = fp1Data.status === 'loading' || fp2Data.status === 'loading' || fp3Data.status === 'loading'
      return fp ?? { results: null, label: 'Freies Training', isLoading: fpLoading }
    }
    if (activeTab === 'sprint_qualifying') {
      return {
        results: fp1Data.status === 'loaded' ? fp1Data.positions : null,
        label: 'FP1 Ergebnis',
        isLoading: fp1Data.status === 'loading',
      }
    }
    return { results: null, label: '' }
  })()

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          {event.isSprintWeekend && (
            <span className="badge bg-f1-red text-white">SPRINT</span>
          )}
        </div>
        <p className="text-f1-muted">{event.circuit} · {event.country}</p>
      </div>

      {/* Session tabs */}
      <div className="flex gap-2 mb-6 border-b border-f1-border">
        {tippableSessions.map(s => (
          <button
            key={s}
            onClick={() => { setActiveTab(s); setUserPickedTab(true) }}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === s
                ? 'border-f1-red text-white'
                : 'border-transparent text-f1-muted hover:text-white'
            }`}
          >
            {SESSION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {activeSessionInfo && !isLocked(activeTab) && (
            <div className="mb-4">
              <CountdownTimer target={activeSessionInfo.startTime} label="Tipp-Deadline" />
            </div>
          )}
          <TipForm
            sessionType={activeTab}
            drivers={drivers}
            existingTip={getTip(activeTab)}
            locked={isLocked(activeTab)}
            onSubmit={submitTip}
          />
        </div>
        <div>
          <ReferenceTable
            results={refInfo.results}
            label={refInfo.label}
            isProvisional={refInfo.isProvisional}
            isLoading={refInfo.isLoading}
          />
        </div>
      </div>
    </div>
  )
}
