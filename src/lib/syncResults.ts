import { Timestamp } from 'firebase/firestore'
import { openf1, findOpenF1Session } from './openf1'
import { processSessionResults, processPositions } from './resultProcessing'
import { getEvents, getDrivers, getSessionResult, saveSessionResult, saveScore, getTipsForSession } from './firestore'
import { calculateScore } from './scoring'
import type { F1Event, Driver, DriverResult, SessionResult, TippableSessionType } from '../types'

export interface SyncResultsResult {
  year: number
  resultsAdded: number
  resultsUpdated: number
  scoresCalculated: number
  skipped: number
}

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}


export async function syncResults(year: number): Promise<SyncResultsResult> {
  const result: SyncResultsResult = { year, resultsAdded: 0, resultsUpdated: 0, scoresCalculated: 0, skipped: 0 }
  const now = new Date()

  const [events, drivers, of1Sessions] = await Promise.all([
    getEvents(),
    getDrivers(year),
    openf1.sessions(year),
  ])

  const yearEvents = events.filter(e => e.id.endsWith(`_${year}`))
  console.log(`[sync] ${yearEvents.length} events, ${of1Sessions.length} sessions, ${drivers.length} drivers`)
  if (yearEvents.length === 0) {
    throw new Error(`Keine Events für ${year} in Firestore — Saison-Sync zuerst ausführen`)
  }
  if (of1Sessions.length === 0) {
    console.log(`[sync] OpenF1 keine Sessions für ${year}, versuche Firestore-Fallback`)
  }

  const driverByNumber = new Map<number, Driver>()
  for (const d of drivers) driverByNumber.set(d.number, d)

  const tippableTypes = Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[]

  for (const event of yearEvents) {
    for (const sessionType of tippableTypes) {
      if ((sessionType === 'sprint_race' || sessionType === 'sprint_qualifying') && !event.isSprintWeekend) continue

      const eventSessionKey = TIPPABLE_TO_EVENT_SESSION[sessionType]
      const sessionInfo = event.sessions[eventSessionKey]
      if (!sessionInfo) continue

      const endTime = sessionInfo.endTime.toDate()
      if (endTime > now) continue

      const existing = await getSessionResult(event.id, sessionType)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3_600_000)
      const officialAt = existing?.officialAt?.toDate()
      if (existing?.status === 'official' && officialAt && officialAt < twoWeeksAgo) continue

      let results: DriverResult[] = []

      const of1Key = findOpenF1Session(of1Sessions, sessionInfo.startTime.toDate())
      if (!of1Key) {
        console.log(`[sync] kein OpenF1-Match: ${event.id}_${sessionType} @ ${sessionInfo.startTime.toDate().toISOString()}`)
      }
      if (of1Key) {
        const sessionRes = await openf1.sessionResults(of1Key)
        results = processSessionResults(sessionRes, driverByNumber)
        if (results.length === 0) {
          const positions = await openf1.positions(of1Key)
          results = processPositions(positions, driverByNumber)
        }
      }

      if (results.length === 0) {
        if (existing && existing.results.length > 0) {
          console.log(`[sync] OpenF1 leer, nutze vorhandene Firestore-Ergebnisse: ${event.id}_${sessionType}`)
          const tips = await getTipsForSession(event.id, sessionType)
          for (const tip of tips) {
            const { points, breakdown } = calculateScore(tip, existing)
            await saveScore({
              id: `${tip.userId}_${event.id}_${sessionType}`,
              userId: tip.userId,
              eventId: event.id,
              sessionType,
              points,
              breakdown,
              isProvisional: existing.status !== 'official',
              calculatedAt: Timestamp.now(),
            })
            result.scoresCalculated++
          }
          continue
        }
        console.log(`[sync] skip (keine Daten): ${event.id}_${sessionType}`)
        result.skipped++
        continue
      }

      const msSinceEnd = now.getTime() - endTime.getTime()
      const isOfficial = msSinceEnd >= 3 * 3_600_000

      const sessionResult: SessionResult = {
        id: `${event.id}_${sessionType}`,
        eventId: event.id,
        sessionType,
        results,
        status: isOfficial ? 'official' : 'provisional',
        fetchedAt: Timestamp.now(),
        ...(isOfficial ? { officialAt: Timestamp.now() } : {}),
      }

      await saveSessionResult(sessionResult)
      console.log(`[sync] ${existing ? 'aktualisiert' : 'neu'}: ${sessionResult.id} (${sessionResult.status})`)
      if (existing) result.resultsUpdated++; else result.resultsAdded++

      const tips = await getTipsForSession(event.id, sessionType)
      for (const tip of tips) {
        const { points, breakdown } = calculateScore(tip, sessionResult)
        await saveScore({
          id: `${tip.userId}_${event.id}_${sessionType}`,
          userId: tip.userId,
          eventId: event.id,
          sessionType,
          points,
          breakdown,
          isProvisional: !isOfficial,
          calculatedAt: Timestamp.now(),
        })
        console.log(`[sync] score: ${tip.userId} / ${event.id}_${sessionType} = ${points} Pkt`)
        result.scoresCalculated++
      }
    }
  }

  return result
}

export async function calculateScoresForSession(
  eventId: string,
  sessionType: TippableSessionType,
  year: number
): Promise<number> {
  const sessionResult = await getSessionResult(eventId, sessionType)
  if (!sessionResult) return 0

  const now = new Date()
  const tips = await getTipsForSession(eventId, sessionType)
  let count = 0
  for (const tip of tips) {
    const { points, breakdown } = calculateScore(tip, sessionResult)
    const endTime = sessionResult.fetchedAt.toDate()
    const msSinceEnd = now.getTime() - endTime.getTime()
    const isOfficial = msSinceEnd >= 3 * 3_600_000
    await saveScore({
      id: `${tip.userId}_${eventId}_${sessionType}`,
      userId: tip.userId,
      eventId,
      sessionType,
      points,
      breakdown,
      isProvisional: !isOfficial,
      calculatedAt: Timestamp.now(),
    })
    count++
  }
  return count
}

export async function recalculateAllScores(year: number): Promise<number> {
  const events = await getEvents()
  const yearEvents = events.filter(e => e.id.endsWith(`_${year}`))
  const now = new Date()
  let total = 0
  for (const event of yearEvents) {
    for (const sessionType of (Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[])) {
      if ((sessionType === 'sprint_race' || sessionType === 'sprint_qualifying') && !event.isSprintWeekend) continue
      const sessionInfo = event.sessions[TIPPABLE_TO_EVENT_SESSION[sessionType]]
      if (!sessionInfo || sessionInfo.endTime.toDate() > now) continue
      total += await calculateScoresForSession(event.id, sessionType, year)
    }
  }
  return total
}
