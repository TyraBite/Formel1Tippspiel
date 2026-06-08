import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeToEvents, getDrivers } from '../lib/firestore'
import { useTips } from '../hooks/useTips'
import { useSessionResult } from '../hooks/useSessionResults'
import { TipForm } from '../components/TipForm'
import { ReferenceTable } from '../components/ReferenceTable'
import { CountdownTimer } from '../components/CountdownTimer'
import type { F1Event, Driver, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race: 'Sprint Race',
}

const REF_SESSION: Record<TippableSessionType, string> = {
  qualifying: 'fp3_or_sprint_q',
  race: 'qualifying',
  sprint_qualifying: 'fp1',
  sprint_race: 'fp3_or_sprint_q',
}

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<F1Event | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [activeTab, setActiveTab] = useState<TippableSessionType>('qualifying')

  useEffect(() => {
    const unsub = subscribeToEvents(events => {
      setEvent(events.find(e => e.id === eventId) ?? null)
    })
    const year = parseInt(eventId?.match(/(\d{4})/)?.[1] ?? String(new Date().getFullYear()))
    getDrivers(year).then(setDrivers)
    return unsub
  }, [eventId])

  const { getTip, isLocked, submitTip } = useTips(event)

  const refSessionType = REF_SESSION[activeTab]
  const refResult = useSessionResult(eventId, refSessionType)

  const refLabel: Record<TippableSessionType, string> = {
    qualifying: event?.isSprintWeekend ? 'Sprint Qualifying Ergebnis' : 'FP3 Ergebnis',
    race: 'Qualifying Ergebnis',
    sprint_qualifying: 'FP1 Ergebnis',
    sprint_race: 'Sprint Qualifying Ergebnis',
  }

  const tippableSessions: TippableSessionType[] = event?.isSprintWeekend
    ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
    : ['qualifying', 'race']

  const activeSessionInfo = (() => {
    if (!event) return null
    if (activeTab === 'qualifying') return event.sessions.qualifying
    if (activeTab === 'race') return event.sessions.race
    if (activeTab === 'sprint_race') return event.sessions.sprint_race ?? null
    if (activeTab === 'sprint_qualifying') return event.sessions.fp3_or_sprint_q ?? null
    return null
  })()

  if (!event) return <div className="text-f1-muted">Laden...</div>

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
            onClick={() => setActiveTab(s)}
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
          <ReferenceTable result={refResult} label={refLabel[activeTab]} />
        </div>
      </div>
    </div>
  )
}
