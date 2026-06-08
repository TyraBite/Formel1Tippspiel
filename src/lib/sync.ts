import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { openf1, type OpenF1Meeting, type OpenF1Session, type OpenF1Driver } from './openf1'
import type { F1Event, Driver, SessionInfo, SessionStatus } from '../types'

export interface SyncResult {
  year: number
  eventsAdded: number
  eventsUpdated: number
  driversAdded: number
  skipped: boolean
}

const SESSION_KEY_MAP: Record<string, string> = {
  'Practice 1': 'fp1',
  'Practice 2': 'fp2',
  'Practice 3': 'fp3_or_sprint_q',
  'Sprint Qualifying': 'fp3_or_sprint_q',
  'Sprint': 'sprint_race',
  'Qualifying': 'qualifying',
  'Race': 'race',
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function normalizeName(fullName: string): string {
  return fullName
    .split(' ')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

function toSessionInfo(session: OpenF1Session): SessionInfo {
  const end = new Date(session.date_end)
  const status: SessionStatus = end < new Date() ? 'official' : 'upcoming'
  return {
    startTime: Timestamp.fromDate(new Date(session.date_start)),
    endTime: Timestamp.fromDate(end),
    status,
  }
}

function buildEvent(meeting: OpenF1Meeting, sessions: OpenF1Session[], round: number): F1Event {
  const isSprintWeekend = sessions.some(s => s.session_type === 'Sprint')
  const sessionsMap: Record<string, SessionInfo> = {}

  for (const s of sessions) {
    const key = SESSION_KEY_MAP[s.session_type]
    if (key) sessionsMap[key] = toSessionInfo(s)
  }

  if (!sessionsMap['qualifying'] || !sessionsMap['race']) {
    throw new Error(`Missing required sessions for ${meeting.meeting_name}`)
  }

  return {
    id: `${toSlug(meeting.location)}_${meeting.year}`,
    round,
    name: meeting.meeting_name,
    circuit: meeting.circuit_short_name,
    country: meeting.country_name,
    isSprintWeekend,
    sessions: sessionsMap as F1Event['sessions'],
  }
}

export async function syncSeason(year: number): Promise<SyncResult> {
  const result: SyncResult = { year, eventsAdded: 0, eventsUpdated: 0, driversAdded: 0, skipped: false }

  const [meetings, sessions] = await Promise.all([
    openf1.meetings(year),
    openf1.sessions(year),
  ])

  if (meetings.length === 0) {
    result.skipped = true
    return result
  }

  const sessionsByMeeting = new Map<number, OpenF1Session[]>()
  for (const s of sessions) {
    const arr = sessionsByMeeting.get(s.meeting_key) ?? []
    arr.push(s)
    sessionsByMeeting.set(s.meeting_key, arr)
  }

  const existingSnap = await getDocs(collection(db, 'events'))
  const existingByRound = new Map<number, F1Event>(
    existingSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as F1Event))
      .filter(e => e.id.endsWith(`_${year}`))
      .map(e => [e.round, e])
  )

  const sorted = [...meetings].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )

  for (let i = 0; i < sorted.length; i++) {
    const meeting = sorted[i]
    const round = i + 1
    const meetingSessions = sessionsByMeeting.get(meeting.meeting_key) ?? []
    const existing = existingByRound.get(round)

    if (existing) {
      const updates: Record<string, string> = {}
      for (const s of meetingSessions) {
        const key = SESSION_KEY_MAP[s.session_type]
        if (!key) continue
        const status: SessionStatus = new Date(s.date_end) < new Date() ? 'official' : 'upcoming'
        updates[`sessions.${key}.status`] = status
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'events', existing.id), updates)
        result.eventsUpdated++
      }
    } else {
      try {
        const event = buildEvent(meeting, meetingSessions, round)
        await setDoc(doc(db, 'events', event.id), event)
        result.eventsAdded++
      } catch {
        // Skip meetings without qualifying/race (e.g. pre-season tests)
      }
    }
  }

  // Sync drivers only if collection is empty
  const driversSnap = await getDocs(collection(db, `drivers_${year}`))
  if (driversSnap.empty) {
    const firstRace = sessions
      .filter(s => s.session_type === 'Race')
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0]

    if (firstRace) {
      const apiDrivers = await openf1.drivers(firstRace.session_key)
      const unique = new Map<number, OpenF1Driver>()
      for (const d of apiDrivers) unique.set(d.driver_number, d)

      for (const d of unique.values()) {
        const name = normalizeName(d.full_name)
        const driver: Driver = {
          id: toSlug(name),
          code: d.name_acronym,
          name,
          team: d.team_name,
          number: d.driver_number,
        }
        await setDoc(doc(db, `drivers_${year}`, driver.id), driver)
        result.driversAdded++
      }
    }
  }

  return result
}
