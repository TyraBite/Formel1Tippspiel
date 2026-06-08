import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToEvents, subscribeToEventTips } from '../lib/firestore'
import { useAuth } from '../contexts/AuthContext'
import { CountdownTimer } from '../components/CountdownTimer'
import type { F1Event, Tip, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Q',
  sprint_race: 'Sprint',
}

const TIPPABLE_SESSION_KEY: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_qualifying: 'fp3_or_sprint_q',
  sprint_race: 'sprint_race',
}

export function HomePage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<F1Event[]>([])
  const [myTips, setMyTips] = useState<Tip[]>([])

  useEffect(() => subscribeToEvents(setEvents), [])

  const now = new Date()

  const upcomingEvents = events.filter(e => e.sessions.race.startTime.toDate() > now)
  const nextEvent = upcomingEvents[0] ?? null

  useEffect(() => {
    if (!nextEvent) return
    return subscribeToEventTips(nextEvent.id, tips =>
      setMyTips(tips.filter(t => t.userId === user?.id))
    )
  }, [nextEvent?.id, user?.id])

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
        <div className="card mb-8 border-l-4 border-l-f1-red">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-f1-red text-xs font-bold uppercase tracking-widest">Nächstes Event</p>
                <span className="text-f1-border">·</span>
                <span className="text-f1-muted text-xs font-mono font-bold">R{nextEvent.round}</span>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-tight">{nextEvent.name}</h2>
              <p className="text-f1-muted text-sm mt-1">{nextEvent.circuit}</p>
            </div>
            {nextEvent.isSprintWeekend && (
              <span className="badge bg-f1-red text-white">Sprint</span>
            )}
          </div>
          {nextSession(nextEvent) && (
            <CountdownTimer target={nextSession(nextEvent)!.startTime} label="Nächste Session" />
          )}

          {(() => {
            const tippable: TippableSessionType[] = nextEvent.isSprintWeekend
              ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
              : ['qualifying', 'race']
            const openSessions = tippable.filter(st => {
              const info = nextEvent.sessions[TIPPABLE_SESSION_KEY[st]]
              return info && info.startTime.toDate() > now
            })
            if (openSessions.length === 0) return null
            return (
              <div className="flex gap-2 mt-4 flex-wrap">
                {openSessions.map(st => {
                  const tipped = myTips.some(t => t.sessionType === st)
                  return (
                    <span key={st} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                      tipped
                        ? 'border-f1-green text-f1-green'
                        : 'border-f1-muted text-f1-muted'
                    }`}>
                      {tipped ? '✓' : '○'} {SESSION_LABELS[st]}
                    </span>
                  )
                })}
              </div>
            )
          })()}

          <Link to={`/event/${nextEvent.id}`} className="btn-primary block text-center mt-4 text-sm">
            Jetzt tippen
          </Link>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4">Kommende Events</h2>
      <div className="flex flex-col gap-3">
        {upcomingEvents.map(event => {
          const raceDate = event.sessions.race.startTime.toDate()
          const dateStr = raceDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
          return (
            <Link key={event.id} to={`/event/${event.id}`}
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
              <span className="text-f1-muted text-xs">{dateStr}</span>
            </Link>
          )
        })}
        {upcomingEvents.length === 0 && (
          <p className="text-f1-muted text-sm">Keine weiteren Events in dieser Saison.</p>
        )}
      </div>
    </div>
  )
}
