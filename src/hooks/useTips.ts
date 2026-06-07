import { useState, useEffect } from 'react'
import { saveTip, subscribeToEventTips } from '../lib/firestore'
import { useAuth } from '../contexts/AuthContext'
import type { Tip, TippableSessionType, F1Event } from '../types'
import { Timestamp } from 'firebase/firestore'

export function useTips(event: F1Event | null) {
  const { user } = useAuth()
  const [tips, setTips] = useState<Tip[]>([])

  useEffect(() => {
    if (!event) return
    return subscribeToEventTips(event.id, setTips)
  }, [event?.id])

  function getTip(sessionType: TippableSessionType): Tip | undefined {
    return tips.find(t => t.userId === user?.id && t.sessionType === sessionType)
  }

  function getAllTips(sessionType: TippableSessionType): Tip[] {
    return tips.filter(t => t.sessionType === sessionType)
  }

  function isLocked(sessionType: TippableSessionType): boolean {
    if (!event || !user) return false
    const session = getSessionInfo(event, sessionType)
    if (!session) return false
    return session.startTime.toDate() <= new Date()
  }

  async function submitTip(sessionType: TippableSessionType, predictions: Record<string, string>) {
    if (!user || !event) return
    if (isLocked(sessionType)) throw new Error('Session bereits gestartet')
    await saveTip({
      id: `${user.id}_${event.id}_${sessionType}`,
      userId: user.id,
      eventId: event.id,
      sessionType,
      predictions,
      updatedAt: Timestamp.now(),
    })
  }

  return { getTip, getAllTips, isLocked, submitTip }
}

function getSessionInfo(event: F1Event, sessionType: TippableSessionType) {
  if (sessionType === 'qualifying') return event.sessions.qualifying
  if (sessionType === 'race') return event.sessions.race
  if (sessionType === 'sprint_race') return event.sessions.sprint_race ?? null
  if (sessionType === 'sprint_qualifying') return event.sessions.fp3_or_sprint_q ?? null
  return null
}
