import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { openf1 } from '../src/lib/openf1'
import { calculateScore } from '../src/lib/scoring'
import { processPositions } from '../src/lib/resultProcessing'
import type { F1Event, Driver, SessionResult, Score, Tip, TippableSessionType } from '../src/types'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const RESULTS_SESSION_MAP: Partial<Record<string, TippableSessionType>> = {
  'Race': 'race',
  'Qualifying': 'qualifying',
  'Sprint': 'sprint_race',
  'Sprint Qualifying': 'sprint_qualifying',
}

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, string> = {
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

async function syncResults(year: number) {
  const now = new Date()
  console.log(`\nSyncing results for ${year}...`)

  const [of1Sessions, of1Meetings] = await Promise.all([
    openf1.sessions(year),
    openf1.meetings(year),
  ])

  if (of1Sessions.length === 0) {
    console.log(`No OpenF1 sessions found for ${year}, skipping.`)
    return
  }

  const eventsSnap = await db.collection('events').get()
  const yearEvents = eventsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as F1Event))
    .filter(e => e.id.endsWith(`_${year}`))

  if (yearEvents.length === 0) {
    console.log(`No events found in Firestore for ${year}.`)
    return
  }

  const driversSnap = await db.collection(`drivers_${year}`).get()
  const driverByNumber = new Map<number, Driver>()
  for (const d of driversSnap.docs) {
    const driver = d.data() as Driver
    driverByNumber.set(driver.number, driver)
  }

  const meetingByKey = new Map<number, typeof of1Meetings[0]>()
  for (const m of of1Meetings) meetingByKey.set(m.meeting_key, m)

  const sessionKeyIndex = new Map<string, number>()
  for (const s of of1Sessions) {
    const tippableType = RESULTS_SESSION_MAP[s.session_type]
    if (!tippableType) continue
    const meeting = meetingByKey.get(s.meeting_key)
    if (!meeting) continue
    for (const slug of [toSlug(meeting.location), toSlug(meeting.country_name)]) {
      sessionKeyIndex.set(`${slug}_${year}_${tippableType}`, s.session_key)
    }
  }

  let resultsAdded = 0, resultsUpdated = 0, scoresCalculated = 0, skipped = 0

  const tippableTypes = Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[]

  for (const event of yearEvents) {
    const eventData = event as any
    for (const sessionType of tippableTypes) {
      const eventSessionKey = TIPPABLE_TO_EVENT_SESSION[sessionType]
      const sessionInfo = eventData.sessions?.[eventSessionKey]
      if (!sessionInfo) continue

      const endTime: Date = sessionInfo.endTime.toDate()
      if (endTime > now) continue

      const existingSnap = await db.collection('session_results').doc(`${event.id}_${sessionType}`).get()
      const existing = existingSnap.exists ? existingSnap.data() as SessionResult : null
      if (existing?.status === 'official') continue

      const of1Key = sessionKeyIndex.get(`${event.id}_${sessionType}`)
      if (!of1Key) {
        console.log(`  No session key for ${event.id}_${sessionType}, skipping.`)
        skipped++
        continue
      }

      const positions = await openf1.positions(of1Key)
      if (positions.length === 0) {
        console.log(`  No position data yet for ${event.id}_${sessionType}, skipping.`)
        skipped++
        continue
      }

      const results = processPositions(positions, driverByNumber)
      if (results.length === 0) { skipped++; continue }

      const msSinceEnd = now.getTime() - endTime.getTime()
      const isOfficial = msSinceEnd >= 3 * 3_600_000

      const sessionResult: SessionResult = {
        id: `${event.id}_${sessionType}`,
        eventId: event.id,
        sessionType,
        results,
        status: isOfficial ? 'official' : 'provisional',
        fetchedAt: Timestamp.now() as any,
        ...(isOfficial ? { officialAt: Timestamp.now() as any } : {}),
      }

      await db.collection('session_results').doc(sessionResult.id).set(sessionResult)
      console.log(`  ${existing ? 'Updated' : 'Added'} result: ${sessionResult.id} (${sessionResult.status})`)
      if (existing) resultsUpdated++; else resultsAdded++

      const tipsSnap = await db.collection('tips')
        .where('eventId', '==', event.id)
        .where('sessionType', '==', sessionType)
        .get()

      for (const tipDoc of tipsSnap.docs) {
        const tip = tipDoc.data() as Tip
        const { points, breakdown } = calculateScore(tip, sessionResult)
        const score: Score = {
          id: `${tip.userId}_${event.id}_${sessionType}`,
          userId: tip.userId,
          eventId: event.id,
          sessionType,
          points,
          breakdown,
          isProvisional: !isOfficial,
          calculatedAt: Timestamp.now() as any,
        }
        await db.collection('scores').doc(score.id).set(score)
        console.log(`  Score: ${score.id} = ${points} pts`)
        scoresCalculated++
      }
    }
  }

  console.log(`Done: ${resultsAdded} added, ${resultsUpdated} updated, ${scoresCalculated} scores, ${skipped} skipped.`)
}

const year = new Date().getFullYear()
syncResults(year).catch(console.error).finally(() => process.exit(0))
