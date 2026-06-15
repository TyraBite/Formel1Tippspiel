import { useState, useEffect } from 'react'
import { openf1, findOpenF1Session } from './openf1'
import { processPositions } from './resultProcessing'
import type { F1Event, Driver, DriverResult, TippableSessionType } from '../types'

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}

const POLL_MS = 15_000

export function useLivePositions(
  event: F1Event | null,
  sessionType: TippableSessionType,
  drivers: Driver[]
): DriverResult[] {
  const [positions, setPositions] = useState<DriverResult[]>([])

  useEffect(() => {
    if (!event || drivers.length === 0) return

    const sessionInfo = event.sessions[TIPPABLE_TO_EVENT_SESSION[sessionType]]
    if (!sessionInfo) return

    const now = new Date()
    const startTime = sessionInfo.startTime.toDate()
    const endTime = sessionInfo.endTime.toDate()
    if (!(startTime <= now && now < endTime)) return

    const year = parseInt(event.id.split('_').pop() ?? '2026')
    const driverByNumber = new Map(drivers.map(d => [d.number, d]))
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function poll(key: number) {
      if (cancelled) return
      try {
        const data = await openf1.positions(key)
        if (!cancelled) setPositions(processPositions(data, driverByNumber))
      } catch { /* ignore transient network errors */ }
    }

    async function init() {
      let sessions
      try { sessions = await openf1.sessions(year) } catch { return }
      if (cancelled) return
      const key = findOpenF1Session(sessions, startTime)
      if (!key) return
      await poll(key)
      timer = setInterval(() => { void poll(key) }, POLL_MS)
    }

    void init()
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [event?.id, sessionType, drivers.length])

  return positions
}
