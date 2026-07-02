# Handoff: HistoryPage Bug + Admin Tip Management

**Generated**: 2026-07-02
**Branch**: main
**Status**: Committed & pushed — deploy in progress via GitHub Actions

## Goal

Fix two bugs from the race weekend (tips invisible after session start, FP status messages uninformative) and add admin tip management to AdminPage so any player's tips can be added/edited retroactively via the same TipForm UI.

## Completed

- [x] **Bug:** HistoryPage showed "Tipps werden nach Session-Start sichtbar" during active sessions — tips are now shown in read-only grid as soon as session starts (live positions still shown above tips while session is active)
- [x] **Bug:** FP2/FP3 reference data showed silent empty state — `usePracticePositions` now has granular status: `no-data` / `fetch-error` / `no-session` with descriptive messages in HistoryPage
- [x] **Feature:** AdminPage — new "Tipps verwalten" section: Event dropdown → Session tabs → Player dropdown → TipForm (locked=false) → save via `saveTip()`
- [x] **Firestore rules:** Tips create/update now allows any authenticated user (was: only own tips, only if not locked) — needed for admin to write other player's tips
- [x] Commit `3db65b5` on main, pushed — GitHub Actions `deploy.yml` triggered

## Not Yet Done

- [ ] Verify deployment at `https://tyrabite.github.io/Formel1Tippspiel/admin` — admin tip form should show and save correctly
- [ ] Check if Firestore rules were deployed by `deploy.yml` (it runs `firebase deploy --only firestore:rules`) — if not, deploy manually: `firebase deploy --only firestore:rules`

## Failed Approaches (Don't Repeat These)

None for this session.

## Key Decisions

| Decision | Rationale |
|---|---|
| Show tips during active session (not just after scores) | Tips are locked at session start — no reason to hide them. Users want to compare predictions while watching the race. |
| Relax Firestore tip rules to `auth != null` | App has only 2 trusted users. Admin needs to write other player's tips. Simple auth check is correct for this use case. |
| Reuse `saveTip()` for admin saves | Function already uses `merge: true` and sets `updatedAt` internally. No new Firestore code needed. |
| `adminSessions` derived from `selectedEvent.isSprintWeekend` in render | Sprint weekends have extra session tabs; non-sprint only qualifying + race. |

## Current State

**Working**: All TypeScript clean, 19/19 unit tests pass, commit on origin/main.

**Deploy status**: GitHub Actions `deploy.yml` should be running. Check: `https://github.com/TyraBite/Formel1Tippspiel/actions`

**Uncommitted (ignore)**: `README.md` (pre-existing changes), `package-lock.json` (minor lockfile update from `npm install` to fix rolldown binding), `src/assets/`, `tailwind.config.js` (untracked, pre-existing).

## Files to Know

| File | Why It Matters |
|---|---|
| `src/pages/HistoryPage.tsx` | Bug fix: tips grid now renders inside `sessionStarted` branch instead of only after scores available |
| `src/pages/AdminPage.tsx` | New "Tipps verwalten" section with full state management and TipForm integration |
| `src/lib/usePracticePositions.ts` | New status type `PracticeStatus` — callers checking `status === 'empty'` must be updated |
| `firestore.rules` | Tips rules relaxed — verify this deployed correctly |

## Code Context

**New `PracticeStatus` type** (callers need to handle new values):
```typescript
export type PracticeStatus = 'pending' | 'loading' | 'loaded' | 'no-data' | 'fetch-error' | 'no-session'
// was: 'pending' | 'loading' | 'loaded' | 'empty'
// EventPage only checks 'loaded' and 'loading' — no change needed there
// HistoryPage updated to handle all new statuses
```

**Admin save function** (`AdminPage.tsx`):
```typescript
async function handleAdminSave(sessionType: TippableSessionType, predictions: Record<string, string>) {
  const tip: Omit<Tip, 'lockedAt'> = {
    id: `${selectedUserId}_${selectedEventId}_${sessionType}`,
    userId: selectedUserId,
    eventId: selectedEventId,
    sessionType,
    predictions,
    updatedAt: Timestamp.now(), // overwritten by saveTip() anyway
  }
  await saveTip(tip) // src/lib/firestore.ts:41
  setAdminTip(tip as Tip)
  setAdminSaveStatus('Gespeichert ✓')
}
```

**Firestore rules** (current state):
```firestore
match /tips/{tipId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;   // was: uid == userId && !lockedAt
  allow update: if request.auth != null;   // was: uid == userId && !lockedAt
}
```

**HistoryPage tips visibility logic** (simplified):
```
!sessionStarted → "Tipps werden nach Session-Start sichtbar"
sessionStarted → <>
  {sessionIsActive && <live positions div>}
  <grid of both players' tips (with score breakdown if available)>
  {sessionEnded && noScores && <"Ergebnisse ausstehend">}
</>
```

**Admin state loading chain** (`AdminPage.tsx`):
```
mount → subscribeToEvents() + getUsers()
selectedEventId changes → getDrivers(year) + reset adminSession if needed
selectedEventId + adminSession + selectedUserId change → getTipsForSession() → find by userId → setAdminTip()
```

## Resume Instructions

1. Check deploy: `https://github.com/TyraBite/Formel1Tippspiel/actions` — wait for green
2. Open `https://tyrabite.github.io/Formel1Tippspiel/admin`
3. Scroll to "Tipps verwalten" — select an event, session, player
4. Fill TipForm → click Speichern → expect "Gespeichert ✓"
   - If Firestore permission error → rules not deployed yet: `firebase deploy --only firestore:rules`
5. Log in as the other player → check EventPage for that event — tip should appear in locked (read-only) view
6. Navigate to HistoryPage for a past event → verify both players' tips visible without needing scores

## Setup Required

Local dev:
```bash
npm run emulators   # Terminal 1 — Firebase Emulator (Auth :9099, Firestore :8080)
npm run seed        # Terminal 2 — seed test data after emulator is ready
npm run dev         # Terminal 3 — dev server at http://localhost:5173/Formel1Tippspiel/
```

Login: `spieler1` / `test1234` or `spieler2` / `test1234`

Admin page: `http://localhost:5173/Formel1Tippspiel/admin` (no nav link — direct URL only)

## Warnings

- `adminSessions` (derived from `selectedEvent?.isSprintWeekend`) is used inside `useEffect` for `selectedEventId` — ESLint exhaustive-deps might warn. The intentional behavior is to reset session type only when the event changes, not when `adminSessions` itself re-derives. Can suppress with `// eslint-disable-next-line` if needed.
- The `package-lock.json` has a minor change from running `npm install` to fix a missing `@rolldown/binding-linux-x64-gnu` native binding (vitest dependency). Fine to commit or ignore.
- `lockedAt` field on tips: never set in production (locking is purely time-based client-side). Firestore rules no longer check for it. The field still exists in the type definition for potential future use.
