import { useState, useEffect } from 'react'
import { subscribeToSessionResult } from '../lib/firestore'
import type { SessionResult } from '../types'

export function useSessionResult(eventId: string | undefined, sessionType: string | undefined) {
  const [result, setResult] = useState<SessionResult | null>(null)

  useEffect(() => {
    if (!eventId || !sessionType) return
    return subscribeToSessionResult(eventId, sessionType, setResult)
  }, [eventId, sessionType])

  return result
}
