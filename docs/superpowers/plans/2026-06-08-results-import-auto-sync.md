# Results Import & Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically fetch F1 race results from OpenF1 API, store them in Firestore, and calculate scores for both players — triggered both on-demand via AdminPage and automatically via GitHub Actions on race weekends.

**Architecture:** A pure `processPositions()` function (no Firebase, fully testable) lives in `src/lib/resultProcessing.ts`. Client-side sync (`src/lib/syncResults.ts`) uses the Web SDK for the AdminPage button. An Admin SDK script (`scripts/sync-results.ts`) runs the same logic for GitHub Actions. Two workflows handle scheduling: `result-sync.yml` (hourly Fri/Sat/Sun + dispatch) and `schedule-check.yml` (daily check that triggers immediate sync on race days).

**Tech Stack:** TypeScript, Firebase Web SDK v12 (client), Firebase Admin SDK v13 (scripts), OpenF1 REST API, Vitest, GitHub Actions

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/resultProcessing.ts` | Pure: OpenF1 position data → `DriverResult[]` |
| Modify | `src/lib/openf1.ts` | Add `OpenF1Position` type + `positions()` endpoint |
| Modify | `src/lib/firestore.ts` | Add `getSessionResult`, `saveSessionResult`, `saveScore`, `getTipsForSession` |
| Create | `src/lib/syncResults.ts` | Client-side results sync (Web SDK) |
| Modify | `src/pages/AdminPage.tsx` | Add "Ergebnisse importieren" button |
| Modify | `firestore.rules` | Add write access for `session_results` and `scores` |
| Create | `scripts/sync-results.ts` | Admin SDK results sync (for GitHub Actions) |
| Create | `scripts/schedule-check.ts` | Detect race weekend, write GITHUB_OUTPUT |
| Modify | `package.json` | Add `sync:results` and `schedule:check` scripts |
| Create | `.github/workflows/result-sync.yml` | Hourly Fri–Sun + dispatch, runs sync:results |
| Create | `.github/workflows/schedule-check.yml` | Daily 06:00 UTC check, triggers result-sync |
| Create | `tests/unit/syncResults.test.ts` | Unit tests for `processPositions` |

---

## Task 1: Add `OpenF1Position` type and `positions()` endpoint to openf1.ts

**Files:**
- Modify: `src/lib/openf1.ts`

- [ ] **Step 1: Add the interface and endpoint**

Open `src/lib/openf1.ts` and apply these changes:

```typescript
const BASE = 'https://api.openf1.org/v1'

export interface OpenF1Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  circuit_short_name: string
  date_start: string
  year: number
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string
  meeting_key: number
  year: number
}

export interface OpenF1Driver {
  driver_number: number
  full_name: string
  name_acronym: string
  team_name: string
  session_key: number
}

export interface OpenF1Position {
  session_key: number
  driver_number: number
  date: string
  meeting_key: number
  position: number
}

async function get<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`OpenF1 ${res.status}: ${path}`)
  return res.json()
}

export const openf1 = {
  meetings: (year: number) => get<OpenF1Meeting>(`/meetings?year=${year}`),
  sessions: (year: number) => get<OpenF1Session>(`/sessions?year=${year}`),
  drivers: (sessionKey: number) => get<OpenF1Driver>(`/drivers?session_key=${sessionKey}`),
  positions: (sessionKey: number) => get<OpenF1Position>(`/position?session_key=${sessionKey}`),
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openf1.ts
git commit -m "feat: add OpenF1 position endpoint"
```

---

## Task 2: Create `src/lib/resultProcessing.ts`

**Files:**
- Create: `src/lib/resultProcessing.ts`
- Create: `tests/unit/syncResults.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/unit/syncResults.test.ts`:

```typescript
import { processPositions } from '../../src/lib/resultProcessing'
import type { Driver } from '../../src/types'
import type { OpenF1Position } from '../../src/lib/openf1'

function makeDriver(number: number, id: string): Driver {
  return { id, code: id.slice(0, 3).toUpperCase(), name: id, team: 'Team', number }
}

function pos(driverNumber: number, position: number, date: string): OpenF1Position {
  return { session_key: 1, driver_number: driverNumber, date, meeting_key: 1, position }
}

describe('processPositions', () => {
  it('returns empty array for empty input', () => {
    const result = processPositions([], new Map())
    expect(result).toEqual([])
  })

  it('maps driver_number to driverId via the map', () => {
    const drivers = new Map([[1, makeDriver(1, 'max_verstappen')]])
    const result = processPositions([pos(1, 1, '2026-05-25T15:00:00')], drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('max_verstappen')
    expect(result[0].driverCode).toBe('MAX')
    expect(result[0].position).toBe(1)
  })

  it('takes the last position entry per driver when multiple exist', () => {
    const drivers = new Map([[1, makeDriver(1, 'ver')]])
    const positions = [
      pos(1, 5, '2026-05-25T14:00:00'),
      pos(1, 1, '2026-05-25T16:00:00'),
      pos(1, 3, '2026-05-25T15:00:00'),
    ]
    const result = processPositions(positions, drivers)
    expect(result[0].position).toBe(1)
  })

  it('sorts results by position ascending', () => {
    const drivers = new Map([
      [1, makeDriver(1, 'ver')],
      [4, makeDriver(4, 'nor')],
      [16, makeDriver(16, 'lec')],
    ])
    const positions = [
      pos(16, 2, '2026-05-25T16:00:00'),
      pos(1, 1, '2026-05-25T16:00:00'),
      pos(4, 3, '2026-05-25T16:00:00'),
    ]
    const result = processPositions(positions, drivers)
    expect(result.map(r => r.driverId)).toEqual(['ver', 'lec', 'nor'])
  })

  it('skips drivers not found in the map', () => {
    const drivers = new Map([[1, makeDriver(1, 'ver')]])
    const positions = [pos(1, 1, '2026-05-25T16:00:00'), pos(99, 2, '2026-05-25T16:00:00')]
    const result = processPositions(positions, drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('ver')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (file not created yet)**

```bash
cd /workspace/work/f1-tipping-game && npm test -- tests/unit/syncResults.test.ts
```

Expected: `Cannot find module '../../src/lib/resultProcessing'`

- [ ] **Step 3: Create `src/lib/resultProcessing.ts`**

```typescript
import type { Driver, DriverResult } from '../types'
import type { OpenF1Position } from './openf1'

export function processPositions(
  positions: OpenF1Position[],
  driverByNumber: Map<number, Driver>
): DriverResult[] {
  const byDriver = new Map<number, { position: number; date: string }>()
  for (const p of positions) {
    const existing = byDriver.get(p.driver_number)
    if (!existing || p.date > existing.date) {
      byDriver.set(p.driver_number, { position: p.position, date: p.date })
    }
  }
  return [...byDriver.entries()]
    .map(([driverNumber, { position }]) => {
      const driver = driverByNumber.get(driverNumber)
      return driver
        ? { position, driverId: driver.id, driverCode: driver.code, driverName: driver.name }
        : null
    })
    .filter((r): r is DriverResult => r !== null)
    .sort((a, b) => a.position - b.position)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/unit/syncResults.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/resultProcessing.ts tests/unit/syncResults.test.ts
git commit -m "feat: add processPositions with tests"
```

---

## Task 3: Extend `firestore.ts` with write functions

**Files:**
- Modify: `src/lib/firestore.ts`

- [ ] **Step 1: Add `getDoc` to the firebase/firestore import and add four new functions**

Open `src/lib/firestore.ts`. Change the first import line from:

```typescript
import {
  collection, doc, getDocs, setDoc,
  query, where, orderBy, Timestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
```

to:

```typescript
import {
  collection, doc, getDocs, getDoc, setDoc,
  query, where, orderBy, Timestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
```

Then append these four functions at the bottom of the file (before the closing of the module):

```typescript
export async function getSessionResult(
  eventId: string,
  sessionType: string
): Promise<SessionResult | null> {
  const snap = await getDoc(doc(db, 'session_results', `${eventId}_${sessionType}`))
  return snap.exists() ? (snap.data() as SessionResult) : null
}

export async function saveSessionResult(result: SessionResult): Promise<void> {
  await setDoc(doc(db, 'session_results', result.id), result)
}

export async function saveScore(score: Score): Promise<void> {
  await setDoc(doc(db, 'scores', score.id), score)
}

export async function getTipsForSession(
  eventId: string,
  sessionType: string
): Promise<Tip[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tips'),
      where('eventId', '==', eventId),
      where('sessionType', '==', sessionType)
    )
  )
  return snap.docs.map(d => d.data() as Tip)
}
```

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
npm test
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add session result and score write functions to firestore"
```

---

## Task 4: Create `src/lib/syncResults.ts`

**Files:**
- Create: `src/lib/syncResults.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Timestamp } from 'firebase/firestore'
import { openf1 } from './openf1'
import { processPositions } from './resultProcessing'
import { getEvents, getDrivers, getSessionResult, saveSessionResult, saveScore, getTipsForSession } from './firestore'
import { calculateScore } from './scoring'
import type { F1Event, Driver, SessionResult, TippableSessionType } from '../types'

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
  if (yearEvents.length === 0 || of1Sessions.length === 0) return result

  const driverByNumber = new Map<number, Driver>()
  for (const d of drivers) driverByNumber.set(d.number, d)

  const meetingLocation = new Map<number, string>()
  for (const m of of1Meetings) meetingLocation.set(m.meeting_key, toSlug(m.location))

  const sessionKeyIndex = new Map<string, number>()
  for (const s of of1Sessions) {
    const tippableType = RESULTS_SESSION_MAP[s.session_type]
    if (!tippableType) continue
    const locationSlug = meetingLocation.get(s.meeting_key)
    if (!locationSlug) continue
    sessionKeyIndex.set(`${locationSlug}_${year}_${tippableType}`, s.session_key)
  }

  const tippableTypes = Object.keys(TIPPABLE_TO_EVENT_SESSION) as TippableSessionType[]

  for (const event of yearEvents) {
    for (const sessionType of tippableTypes) {
      const eventSessionKey = TIPPABLE_TO_EVENT_SESSION[sessionType]
      const sessionInfo = event.sessions[eventSessionKey]
      if (!sessionInfo) continue

      const endTime = sessionInfo.endTime.toDate()
      if (endTime > now) continue

      const existing = await getSessionResult(event.id, sessionType)
      if (existing?.status === 'official') continue

      const of1Key = sessionKeyIndex.get(`${event.id}_${sessionType}`)
      if (!of1Key) { result.skipped++; continue }

      const positions = await openf1.positions(of1Key)
      if (positions.length === 0) { result.skipped++; continue }

      const results = processPositions(positions, driverByNumber)
      if (results.length === 0) { result.skipped++; continue }

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
        result.scoresCalculated++
      }
    }
  }

  return result
}
```

- [ ] **Step 2: Run all tests to confirm no TypeScript errors bubble up**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/syncResults.ts
git commit -m "feat: add client-side syncResults function"
```

---

## Task 5: Update `firestore.rules`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add write access to `session_results` and `scores`**

Change from:

```
match /session_results/{id} { allow read: if request.auth != null; }
match /scores/{id}          { allow read: if request.auth != null; }
```

to:

```
match /session_results/{id} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
match /scores/{id} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
```

The full updated `firestore.rules` should be:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /{driversCol}/{id} {
      allow read: if request.auth != null && driversCol.matches('drivers_[0-9]+');
      allow write: if request.auth != null && driversCol.matches('drivers_[0-9]+');
    }
    match /session_results/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /scores/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /tips/{tipId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.userId
        && !('lockedAt' in request.resource.data);
      allow update: if request.auth.uid == resource.data.userId
        && !('lockedAt' in resource.data);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: allow authenticated writes to session_results and scores"
```

---

## Task 6: Update `AdminPage.tsx`

**Files:**
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Rewrite the component with the new button**

Replace the entire content of `src/pages/AdminPage.tsx` with:

```tsx
import { useState } from 'react'
import { syncSeason, type SyncResult } from '../lib/sync'
import { syncResults, type SyncResultsResult } from '../lib/syncResults'

export function AdminPage() {
  const [seasonStatus, setSeasonStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [seasonResults, setSeasonResults] = useState<SyncResult[]>([])

  const [resultsStatus, setResultsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resultsResult, setResultsResult] = useState<SyncResultsResult | null>(null)

  const [errorMsg, setErrorMsg] = useState('')

  async function handleSeasonSync() {
    setSeasonStatus('loading')
    setSeasonResults([])
    setErrorMsg('')
    try {
      const year = new Date().getFullYear()
      const [r1, r2] = await Promise.all([syncSeason(year), syncSeason(year + 1)])
      setSeasonResults([r1, r2])
      setSeasonStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setSeasonStatus('error')
    }
  }

  async function handleResultsSync() {
    setResultsStatus('loading')
    setResultsResult(null)
    setErrorMsg('')
    try {
      const year = new Date().getFullYear()
      const r = await syncResults(year)
      setResultsResult(r)
      setResultsStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setResultsStatus('error')
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Admin</h1>
        <p className="text-f1-muted text-sm">Verwaltung der Saison- und Ergebnisdaten</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-f1-muted mb-3">Saison</h2>
        <button
          onClick={handleSeasonSync}
          disabled={seasonStatus === 'loading'}
          className="w-full bg-f1-red text-white px-4 py-3 rounded font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {seasonStatus === 'loading' ? 'Synchronisiere...' : 'Saison synchronisieren'}
        </button>

        {seasonStatus === 'done' && (
          <div className="mt-3 space-y-2">
            {seasonResults.map(r => (
              <div key={r.year} className="p-3 bg-f1-card rounded border border-f1-border text-sm">
                <p className="font-medium mb-1">Saison {r.year}</p>
                {r.skipped ? (
                  <p className="text-f1-muted">Noch keine Daten verfügbar</p>
                ) : (
                  <p className="text-f1-muted">
                    {r.eventsAdded} Events hinzugefügt · {r.eventsUpdated} aktualisiert
                    {r.driversAdded > 0 && ` · ${r.driversAdded} Fahrer importiert`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-f1-muted mb-3">Ergebnisse</h2>
        <button
          onClick={handleResultsSync}
          disabled={resultsStatus === 'loading'}
          className="w-full bg-f1-red text-white px-4 py-3 rounded font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {resultsStatus === 'loading' ? 'Importiere...' : 'Ergebnisse importieren & Punkte berechnen'}
        </button>

        {resultsStatus === 'done' && resultsResult && (
          <div className="mt-3 p-3 bg-f1-card rounded border border-f1-border text-sm">
            <p className="font-medium mb-1">Saison {resultsResult.year}</p>
            <p className="text-f1-muted">
              {resultsResult.resultsAdded} Ergebnisse neu ·{' '}
              {resultsResult.resultsUpdated} aktualisiert ·{' '}
              {resultsResult.scoresCalculated} Punkte berechnet
              {resultsResult.skipped > 0 && ` · ${resultsResult.skipped} übersprungen`}
            </p>
          </div>
        )}
      </div>

      {(seasonStatus === 'error' || resultsStatus === 'error') && (
        <div className="p-4 bg-red-950 rounded border border-red-800">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: add results import button to AdminPage"
```

---

## Task 7: Create `scripts/sync-results.ts`

**Files:**
- Create: `scripts/sync-results.ts`

- [ ] **Step 1: Create the Admin SDK version of the sync**

```typescript
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

  // Load events from Firestore
  const eventsSnap = await db.collection('events').get()
  const yearEvents = eventsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as F1Event))
    .filter(e => e.id.endsWith(`_${year}`))

  if (yearEvents.length === 0) {
    console.log(`No events found in Firestore for ${year}.`)
    return
  }

  // Load drivers for number → id mapping
  const driversSnap = await db.collection(`drivers_${year}`).get()
  const driverByNumber = new Map<number, Driver>()
  for (const d of driversSnap.docs) {
    const driver = d.data() as Driver
    driverByNumber.set(driver.number, driver)
  }

  // Build meeting_key → locationSlug map
  const meetingLocation = new Map<number, string>()
  for (const m of of1Meetings) meetingLocation.set(m.meeting_key, toSlug(m.location))

  // Build {eventId}_{tippableType} → session_key index
  const sessionKeyIndex = new Map<string, number>()
  for (const s of of1Sessions) {
    const tippableType = RESULTS_SESSION_MAP[s.session_type]
    if (!tippableType) continue
    const locationSlug = meetingLocation.get(s.meeting_key)
    if (!locationSlug) continue
    sessionKeyIndex.set(`${locationSlug}_${year}_${tippableType}`, s.session_key)
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

      // Check existing result
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
        fetchedAt: Timestamp.now(),
        ...(isOfficial ? { officialAt: Timestamp.now() } : {}),
      }

      await db.collection('session_results').doc(sessionResult.id).set(sessionResult)
      console.log(`  ${existing ? 'Updated' : 'Added'} result: ${sessionResult.id} (${sessionResult.status})`)
      if (existing) resultsUpdated++; else resultsAdded++

      // Fetch tips and calculate scores
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
          calculatedAt: Timestamp.now(),
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sync-results.ts
git commit -m "feat: add Admin SDK results sync script"
```

---

## Task 8: Create `scripts/schedule-check.ts`

**Files:**
- Create: `scripts/schedule-check.ts`

- [ ] **Step 1: Create the script**

```typescript
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { appendFileSync } from 'fs'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function check() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 2 * 3_600_000)   // 2h ago
  const windowEnd = new Date(now.getTime() + 48 * 3_600_000)    // 48h ahead

  const snap = await db.collection('events').get()
  let isRaceWeekend = false

  outer: for (const docSnap of snap.docs) {
    const sessions = docSnap.data().sessions ?? {}
    for (const sessionInfo of Object.values(sessions)) {
      const endTime: Date | undefined = (sessionInfo as any)?.endTime?.toDate?.()
      if (!endTime) continue
      if (endTime >= windowStart && endTime <= windowEnd) {
        isRaceWeekend = true
        break outer
      }
    }
  }

  const output = `is_race_weekend=${isRaceWeekend}`
  console.log(output)

  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) appendFileSync(githubOutput, `${output}\n`)
}

check().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
```

- [ ] **Step 2: Commit**

```bash
git add scripts/schedule-check.ts
git commit -m "feat: add race weekend schedule check script"
```

---

## Task 9: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the two new scripts**

In the `"scripts"` section, add after `"seed:tips-monaco"`:

```json
"sync:results": "tsx scripts/sync-results.ts",
"schedule:check": "tsx scripts/schedule-check.ts"
```

The scripts section should look like:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "emulators": "firebase emulators:start --project demo-f1-tipping",
  "seed": "tsx scripts/seed.ts",
  "seed:prod": "tsx scripts/seed-prod.ts",
  "seed:tips-monaco": "tsx scripts/seed-tips-monaco.ts",
  "sync:results": "tsx scripts/sync-results.ts",
  "schedule:check": "tsx scripts/schedule-check.ts"
},
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add sync:results and schedule:check npm scripts"
```

---

## Task 10: Create `.github/workflows/result-sync.yml`

**Files:**
- Create: `.github/workflows/result-sync.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Sync Race Results

on:
  schedule:
    - cron: '0 * * * 5,6,0'  # every hour on Friday, Saturday, Sunday (UTC)
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Sync results and calculate scores
        run: npm run sync:results
        env:
          FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/result-sync.yml
git commit -m "feat: add result-sync GitHub Actions workflow"
```

---

## Task 11: Create `.github/workflows/schedule-check.yml`

**Files:**
- Create: `.github/workflows/schedule-check.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Race Weekend Check

on:
  schedule:
    - cron: '0 6 * * *'  # daily at 06:00 UTC
  workflow_dispatch:

permissions:
  actions: write
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Check if race weekend
        id: check
        run: npm run schedule:check
        env:
          FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}

      - name: Trigger result sync
        if: steps.check.outputs.is_race_weekend == 'true'
        run: gh workflow run result-sync.yml --ref main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/schedule-check.yml
git commit -m "feat: add daily race weekend check workflow"
```

---

## Task 12: Push and verify

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Manually trigger result-sync to test end-to-end**

In GitHub → Actions → "Sync Race Results" → "Run workflow". Check the logs — it should output lines like:

```
Syncing results for 2026...
  Added result: monaco_2026_race (provisional)
  Score: OOaxsji4p9WIDyzMezdj3XYIJwU2_monaco_2026_race = 12 pts
  Score: m8JFV69FrQfifEkauIaBjghRfhe2_monaco_2026_race = 9 pts
Done: 1 added, 0 updated, 2 scores, 0 skipped.
```

- [ ] **Step 3: Verify scores appear in the app**

Open the deployed app → Leaderboard. Both players should have points. Open History → Monaco 2026 → Race to see the breakdown.

- [ ] **Step 4: Manually trigger schedule-check to verify detection**

In GitHub → Actions → "Race Weekend Check" → "Run workflow". In the logs you should see either `is_race_weekend=true` (if a race is within 48h) or `is_race_weekend=false`.
