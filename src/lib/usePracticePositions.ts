import { useState, useEffect } from 'react'
import { openf1, findOpenF1Session } from './openf1'
import { processPositions } from './resultProcessing'
import type { F1Event, Driver, DriverResult } from '../types'

export type PracticeSessionKey = 'fp1' | 'fp2' | 'fp3_or_sprint_q'

export type PracticeStatus = 'pending' | 'loading' | 'loaded' | 'no-data' | 'fetch-error' | 'no-session'

export interface PracticePositionsResult {
  positions: DriverResult[]
  isLive: boolean
  status: PracticeStatus
  retry: () => void
}

const POLL_MS = 15_000

const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 2_000

async function withRetry<T>(fn: () => Promise<T>, attempts: number, delayMs: number, cancelled: () => boolean): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    if (cancelled()) throw new Error('cancelled')
    try { return await fn() } catch (err) {
      if (i === attempts - 1) throw err
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error('unreachable')
}

export function usePracticePositions(
  event: F1Event | null,
  sessionKey: PracticeSessionKey,
  drivers: Driver[]
): PracticePositionsResult {
  const [positions, setPositions] = useState<DriverResult[]>([])
  const [isLive, setIsLive] = useState(false)
  const [status, setStatus] = useState<PracticePositionsResult['status']>('pending')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!event || drivers.length === 0) { setStatus('pending'); return }

    const sessionInfo = event.sessions[sessionKey]
    if (!sessionInfo) { setStatus('pending'); return }

    const now = new Date()
    const startTime = sessionInfo.startTime.toDate()
    const endTime = sessionInfo.endTime.toDate()

    if (startTime > now) { setStatus('pending'); return }

    const ended = endTime <= now
    const year = parseInt(event.id.split('_').pop() ?? '2026')
    const driverByNumber = new Map(drivers.map(d => [d.number, d]))
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    setStatus('loading')

    async function poll(key: number) {
      if (cancelled) return
      try {
        const data = await withRetry(() => openf1.positions(key), RETRY_ATTEMPTS, RETRY_DELAY_MS, () => cancelled)
        if (!cancelled) {
          const processed = processPositions(data, driverByNumber)
          setPositions(processed)
          setStatus(processed.length > 0 ? 'loaded' : ended ? 'no-data' : 'loading')
        }
      } catch {
        if (!cancelled && ended) setStatus('fetch-error')
        // transient errors during live session are ignored
      }
    }

    async function init() {
      let sessions
      try {
        sessions = await withRetry(() => openf1.sessions(year), RETRY_ATTEMPTS, RETRY_DELAY_MS, () => cancelled)
      } catch { if (!cancelled) setStatus('fetch-error'); return }
      if (cancelled) return
      const key = findOpenF1Session(sessions, startTime)
      if (!key) { setStatus('no-session'); return }
      await poll(key)
      if (!ended && !cancelled) {
        setIsLive(true)
        timer = setInterval(() => { void poll(key) }, POLL_MS)
      }
    }

    void init()
    return () => {
      cancelled = true
      setIsLive(false)
      if (timer) clearInterval(timer)
    }
  }, [event?.id, sessionKey, drivers.length, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { positions, isLive, status, retry: () => setRetryKey(k => k + 1) }
}
