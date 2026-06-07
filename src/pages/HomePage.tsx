import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToEvents } from '../lib/firestore'
import { CountdownTimer } from '../components/CountdownTimer'
import type { F1Event } from '../types'

export function HomePage() {
  const [events, setEvents] = useState<F1Event[]>([])

  useEffect(() => subscribeToEvents(setEvents), [])

  const now = new Date()

  const upcomingEvents = events.filter(e => e.sessions.race.startTime.toDate() > now)
  const nextEvent = upcomingEvents[0] ?? null

  function nextSession(event: F1Event) {
    const sessions = [
      event.sessions.fp1,
      event.sessions.fp3_or_sprint_q,
      event.sessions.qualifying,
      event.sessions.sprint_race,
      event.sessions.race,
    ].filter((s): s is NonNullable<typeof s> => s != null)
    return sessions.find(s => s.startTime.toDate() > now) ?? null
  }

  return (
    <div>
      {nextEvent && (
        <div className="card mb-8 border-f1-red">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-f1-red text-xs font-semibold uppercase tracking-wider mb-1">Nächstes Event</p>
              <h2 className="text-xl font-bold">{nextEvent.name}</h2>
              <p className="text-f1-muted text-sm">{nextEvent.circuit}</p>
            </div>
            {nextEvent.isSprintWeekend && (
              <span className="badge bg-f1-red text-white">SPRINT</span>
            )}
          </div>
          {nextSession(nextEvent) && (
            <CountdownTimer target={nextSession(nextEvent)!.startTime} label="Nächste Session" />
          )}
          <Link to={`/event/${nextEvent.id}`} className="btn-primary block text-center mt-4 text-sm">
            Jetzt tippen
          </Link>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4">Alle Events 2026</h2>
      <div className="flex flex-col gap-3">
        {events.map(event => {
          const isPast = event.sessions.race.startTime.toDate() <= now
          return (
            <Link key={event.id} to={isPast ? `/history/${event.id}` : `/event/${event.id}`}
              className="card hover:border-f1-red transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-f1-muted font-mono text-sm w-6">R{event.round}</span>
                  <span className="font-medium">{event.name}</span>
                  {event.isSprintWeekend && (
                    <span className="badge bg-f1-red text-white text-xs">S</span>
                  )}
                </div>
                <p className="text-f1-muted text-xs ml-8">{event.circuit}</p>
              </div>
              {isPast
                ? <span className="text-f1-green text-xs">Verlauf →</span>
                : <span className="text-f1-muted text-xs">Offen</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
