import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { openf1 } from '../src/lib/openf1'
import type { OpenF1Session } from '../src/lib/openf1'
import { calculateScore } from '../src/lib/scoring'
import { processSessionResults, processPositions } from '../src/lib/resultProcessing'
import { jolpicaResults } from '../src/lib/jolpica'
import type { F1Event, Driver, DriverResult, SessionResult, Score, Tip, TippableSessionType } from '../src/types'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, string> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}

// Match an OpenF1 session to a Firestore session slot by start time proximity.
// Sprint and regular sessions share the same session_type name in OpenF1 ("Race" / "Qualifying"),
// so slug-based matching cannot distinguish them. Time-based matching works because sprint and
// main sessions are always on different days.
function findOpenF1Session(sessions: OpenF1Session[], expectedStart: Date): number | undefined {
  const MAX_DIFF_MS = 2 * 3_600_000
  let best: number | undefined
  let bestDiff = MAX_DIFF_MS
  for (const s of sessions) {
    const diff = Math.abs(new Date(s.date_start).getTime() - expectedStart.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = s.session_key
    }
  }
  return best
}

async function syncResults(year: number) {
  const now = new Date()
  console.log(`\nSyncing results for ${year}...`)

  const of1Sessions = await openf1.sessions(year)

  if (of1Sessions.length === 0) {
    console.log(`[sync] Keine OpenF1 Sessions für ${year} — Firestore-Fallback aktiv`)
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

  const usersSnap = await db.collection('users').get()
  const userIds = usersSnap.docs.map(d => d.id)

  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 3_600_000)
  const eventsToSync = yearEvents
    .map(e => {
      const ed = e as any
      let lastEnd = new Date(0)
      for (const key of Object.values(TIPPABLE_TO_EVENT_SESSION)) {
        const s = ed.sessions?.[key]
        if (s?.endTime) {
          const d: Date = s.endTime.toDate()
          if (d < now && d > lastEnd) lastEnd = d
        }
      }
      return { event: e, lastEnd }
    })
    .filter(({ lastEnd }) => lastEnd > oneMonthAgo)
    .sort((a, b) => b.lastEnd.getTime() - a.lastEnd.getTime())
    .slice(0, 3)
    .map(({ event }) => event)

  console.log(`  ${userIds.length} Spieler, ${of1Sessions.length} Sessions — sync ${eventsToSync.length} Events:`, eventsToSync.map(e => e.id).join(', '))

  let resultsAdded = 0, resultsUpdated = 0, scoresCalculated = 0, skipped = 0

  const tippableTypes = Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[]

  for (const event of eventsToSync) {
    const eventData = event as any
    for (const sessionType of tippableTypes) {
      if ((sessionType === 'sprint_race' || sessionType === 'sprint_qualifying') && !eventData.isSprintWeekend) continue

      const eventSessionKey = TIPPABLE_TO_EVENT_SESSION[sessionType]
      const sessionInfo = eventData.sessions?.[eventSessionKey]
      if (!sessionInfo) continue

      const endTime: Date = sessionInfo.endTime.toDate()
      if (endTime > now) continue

      const existingSnap = await db.collection('session_results').doc(`${event.id}_${sessionType}`).get()
      const existing = existingSnap.exists ? existingSnap.data() as SessionResult : null
      const officialAt = (existing?.officialAt as any)?.toDate?.()
      if (existing?.status === 'official' && officialAt && officialAt < oneMonthAgo) {
        console.log(`  ${event.id}_${sessionType}: offiziell seit ${officialAt.toISOString().slice(0,10)} → übersprungen`)
        continue
      }

      let results: DriverResult[] = []

      const of1Key = findOpenF1Session(of1Sessions, sessionInfo.startTime.toDate())
      if (of1Key) {
        const sessionRes = await openf1.sessionResults(of1Key)
        console.log(`  session_key=${of1Key}: ${sessionRes.length} Einträge (session_result)`)
        results = processSessionResults(sessionRes, driverByNumber)
        if (results.length === 0) {
          const positions = await openf1.positions(of1Key)
          console.log(`  session_key=${of1Key}: ${positions.length} Positionen (Fallback /position)`)
          results = processPositions(positions, driverByNumber)
        }
        console.log(`  ${event.id}_${sessionType}: ${results.length} Fahrer`)
      } else {
        console.log(`[sync] kein OpenF1-Match: ${event.id}_${sessionType} @ ${sessionInfo.startTime.toDate().toISOString()}`)
      }

      if (results.length === 0 && eventData.round) {
        results = await jolpicaResults(sessionType, year, eventData.round, driverByNumber)
        if (results.length > 0) console.log(`[sync] Jolpica: ${event.id}_${sessionType}`)
      }

      if (results.length === 0) {
        if (existing && existing.results && existing.results.length > 0) {
          console.log(`[sync] OpenF1 leer, nutze Firestore-Daten: ${event.id}_${sessionType}`)
          for (const userId of userIds) {
            const tipDoc = await db.collection('tips').doc(`${userId}_${event.id}_${sessionType}`).get()
            if (!tipDoc.exists) continue
            const tip = tipDoc.data() as Tip
            const { points, breakdown } = calculateScore(tip, existing)
            const score: Score = {
              id: `${userId}_${event.id}_${sessionType}`,
              userId,
              eventId: event.id,
              sessionType,
              points,
              breakdown,
              isProvisional: existing.status !== 'official',
              calculatedAt: Timestamp.now() as any,
            }
            await db.collection('scores').doc(score.id).set(score)
            console.log(`  Score: ${score.id} = ${points} pts`)
            scoresCalculated++
          }
        } else {
          console.log(`  Keine Daten für ${event.id}_${sessionType}, übersprungen.`)
          skipped++
        }
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
        fetchedAt: Timestamp.now() as any,
        ...(isOfficial ? { officialAt: Timestamp.now() as any } : {}),
      }

      await db.collection('session_results').doc(sessionResult.id).set(sessionResult)
      console.log(`  ${existing ? 'Updated' : 'Added'} result: ${sessionResult.id} (${sessionResult.status})`)
      if (existing) resultsUpdated++; else resultsAdded++

      for (const userId of userIds) {
        const tipDoc = await db.collection('tips').doc(`${userId}_${event.id}_${sessionType}`).get()
        if (!tipDoc.exists) {
          console.log(`  Kein Tipp: ${userId}_${event.id}_${sessionType}`)
          continue
        }
        const tip = tipDoc.data() as Tip
        const { points, breakdown } = calculateScore(tip, sessionResult)
        const score: Score = {
          id: `${userId}_${event.id}_${sessionType}`,
          userId,
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
syncResults(year)
  .then(() => process.exit(0))
  .catch(err => { console.error('[sync] Fatal:', err); process.exit(1) })
