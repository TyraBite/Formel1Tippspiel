import { Timestamp } from 'firebase/firestore'
import { openf1 } from './openf1'
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

const RESULTS_SESSION_MAP: Partial<Record<string, TippableSessionType>> = {
  'Race': 'race',
  'Qualifying': 'qualifying',
  'Sprint': 'sprint_race',
  'Sprint Qualifying': 'sprint_qualifying',
  'Sprint Shootout': 'sprint_qualifying',
}

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export async function syncResults(year: number): Promise<SyncResultsResult> {
  const result: SyncResultsResult = { year, resultsAdded: 0, resultsUpdated: 0, scoresCalculated: 0, skipped: 0 }
  const now = new Date()

  const [events, drivers, of1Sessions, of1Meetings] = await Promise.all([
    getEvents(),
    getDrivers(year),
    openf1.sessions(year),
    openf1.meetings(year),
  ])

  const yearEvents = events.filter(e => e.id.endsWith(`_${year}`))
  console.log(`[sync] ${yearEvents.length} events, ${of1Sessions.length} sessions, ${drivers.length} drivers`)
  if (yearEvents.length === 0 || of1Sessions.length === 0) return result

  const driverByNumber = new Map<number, Driver>()
  for (const d of drivers) driverByNumber.set(d.number, d)

  const meetingByKey = new Map<number, typeof of1Meetings[0]>()
  for (const m of of1Meetings) meetingByKey.set(m.meeting_key, m)

  // Index by both location (city) and country_name slugs: OpenF1 uses city names
  // ("Melbourne", "Shanghai") but Firestore event IDs use country names ("australia", "china")
  const sessionKeyIndex = new Map<string, number>()
  for (const s of of1Sessions) {
    const tippableType = RESULTS_SESSION_MAP[s.session_type]
    if (!tippableType) continue
    const meeting = meetingByKey.get(s.meeting_key)
    if (!meeting) continue
    // Extract first word of meeting_name for edge cases like "miami" from "Miami Grand Prix"
    const meetingFirstWord = toSlug(meeting.meeting_name.split(' ')[0])
    for (const slug of new Set([toSlug(meeting.location), toSlug(meeting.country_name), meetingFirstWord])) {
      sessionKeyIndex.set(`${slug}_${year}_${tippableType}`, s.session_key)
    }
  }

  const unmapped = [...new Set(of1Sessions.map(s => s.session_type).filter(t => !(t in RESULTS_SESSION_MAP)))]
  if (unmapped.length) console.log('[sync] ungemappte Session-Typen:', unmapped)

  const tippableTypes = Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[]

  for (const event of yearEvents) {
    for (const sessionType of tippableTypes) {
      // Sprint sessions only exist on sprint weekends
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

      const of1Key = sessionKeyIndex.get(`${event.id}_${sessionType}`)
      if (of1Key) {
        const sessionRes = await openf1.sessionResults(of1Key)
        results = processSessionResults(sessionRes, driverByNumber)
        if (results.length === 0) {
          const positions = await openf1.positions(of1Key)
          results = processPositions(positions, driverByNumber)
        }
      }

      if (results.length === 0) { console.log(`[sync] skip (keine Daten): ${event.id}_${sessionType}`); result.skipped++; continue }

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
