# Handoff: F1 Tippspiel — Feature Sprint

**Generated**: 2026-07-03
**Branch**: main (4 commits ahead of origin — push to deploy)
**Status**: In Progress (active development, all features working)

## Goal

Zweispieler-F1-Tippspiel (React + Vite + Firebase + Tailwind v4, deployed auf GitHub Pages). Laufende Feature-Erweiterungen und UX-Verbesserungen.

## Completed

- [x] Team-Farbakzente in TipForm (border-left + bg-tint), DriverCombobox, HistoryPage
- [x] Firestore Security Fix: isAdmin-Check in Tips-Rules
- [x] DNF/DNS/DSQ-Anzeige in ReferenceTable + HistoryPage
- [x] Freshness-Indicator auf LeaderboardPage
- [x] Live-Seite (`/live`): Wetter, Race Control, Live-Positionen
- [x] Statistiken-Seite (`/stats`): Trefferquoten, Saison-Trend (Recharts), H2H-Tabelle, Fahrer-Profil
- [x] Mobile-first Burger-Nav: Slide-Drawer mit Nav + ThemeToggle + Logout; Desktop-Nav bleibt
- [x] Carbon als Default-Theme; Anti-Flash-Script in index.html
- [x] Deutsche UI-Texte: "Tipps" statt "Home", "Direktvergleich", "Unentschieden", "Sieger", "Nacht"
- [x] UX: Tipp-Deadline-Urgency (<1h roter Rahmen), Vollständig-Indikator (grüner Punkt) in TipForm
- [x] Secret Admin-Nav: Admin-User klickt auf Namen im Drawer → `/admin`
- [x] Live-Seite erweitert: Compound-Badge (S/M/H/I/W), Gap-to-leader, Pit-Stopps-Feed, Tipp-Saisonstand
- [x] Fahrer-Prognose: alle Fahrer, exakte Treffer (3Pkt) als Spalte, Sortierung nach Gesamtpunkten
- [x] AccuracyBar "Daneben": `bg-f1-border` → `bg-slate-500` (war unsichtbar)
- [x] Carbon-Theme stärker: `f1-dark` `#000000`, `f1-card` `#0d0d0d`, Textur auf Nav + Drawer
- [x] Fix: OpenF1 Rate-Limit bei Saison-Sync (sequential statt parallel, meetings-Cache)
- [x] Fix: British GP Sprint Qualifying Zeit korrigiert (16:30Z → 15:30Z, war BST als UTC)
- [x] Fix: Saison-Sync nur aktuelles Jahr (2027 liefert 404)
- [x] Feature: Tipps auf LivePage — neue Card zwischen Live-Positionen und Saisonstand
- [x] Feature: `subscribeToAllTips()` in firestore.ts hinzugefügt

## Not Yet Done

- [ ] Push Notifications (bewusst zurückgestellt — Nutzer entschied "vorerst nicht")
- [ ] Deployment: 4 Commits noch nicht gepusht (`git push` ausstehend)

## Failed Approaches (Don't Repeat These)

**Tipps in LeaderboardPage inline anzeigen**: Wurde implementiert (pro Event Session-Breakdowns mit 2-Spalten-Grid), aber User wollte das alte kompakte Design zurück (Event + Gesamtpunkte als Link zur HistoryPage). Reverted. **HistoryPage zeigt Tipps bereits korrekt ab Session-Start** — kein weiterer Change nötig dort.

**OpenF1 parallele Requests**: `syncSeason(2026)` und `syncSeason(2027)` parallel → 429 Rate-Limit. Fix: sequentiell + meetings-Cache.

**syncSeason(year + 1)**: OpenF1 hat 2027 noch nicht → 404. Fix: nur aktuelles Jahr synchen.

**Recharts Tooltip TypeScript**: `formatter={(value: number, name: string)}` schlägt fehl. Fix: `String(value)` + `String(name)`, `labelFormatter` via `(_, payload) => payload?.[0]?.payload?.name ?? ''`.

**resultProcessing.ts flatMap**: `map` + `filter` mit Type-Predicate erzeugt `true | undefined`. Fix: `flatMap` mit expliziter Annotation.

**Firestore lockedAt-Check**: `resource.data.lockedAt == null` wirft "Property lockedAt is undefined". Korrekt: `!('lockedAt' in resource.data)`.

**OpenF1 Rate-Limiting**: Mehrere parallele `openf1.sessions(year)` → Rate-Limit. Fix: `_sessionsCache` + `_meetingsCache` auf Module-Level.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| `isAdmin` Feld in Firestore `users`-Doc | Muss manuell in Firebase Console gesetzt werden |
| Carbon als Default-Theme | Nutzer-Präferenz |
| Rangliste: kompakte Eventliste mit Link zur HistoryPage | User wollte inline-Tips rückgängig; HistoryPage ist die Detailansicht |
| HistoryPage zeigt Tipps ab Session-Start | `!sessionStarted` → "Tipps werden nach Session-Start sichtbar"; bereits implementiert |
| LivePage Tipps-Card: nur für aktive Session | `sessionTips = tips.filter(t => t.sessionType === activeSessionType)` |
| Saison-Sync nur aktuelles Jahr | 2027 gibt 404 bei OpenF1 |

## Current State

**Working**: Alle Features funktionieren. Build sauber. 19/19 Tests grün.

**Uncommitted Changes**: `README.md` modifiziert (nicht kritisch), `src/assets/` und `tailwind.config.js` ungetrackt (auto-generiert, nicht committen).

**Ausstehend**: `git push origin main` zum Deployen auf GitHub Pages.

## Files to Know

| File | Why It Matters |
|------|----------------|
| `src/components/Layout.tsx` | Burger-Drawer, Body-Scroll-Lock, carbon-surface Klasse |
| `src/index.css` | Tailwind v4 CSS-first: `@theme {}`, `[data-theme="carbon"]` Override, `.carbon-surface` |
| `src/lib/openf1.ts` | OpenF1-Interfaces + Methoden; `_sessionsCache` + `_meetingsCache` für Rate-Limit |
| `src/lib/firestore.ts` | Alle Firestore-Funktionen; `subscribeToAllTips()` neu |
| `src/pages/LivePage.tsx` | Live-Session-Erkennung, Polling, Tipps-Card (neu) |
| `src/pages/HistoryPage.tsx` | Zeigt Tipps ab Session-Start, Scores falls vorhanden |
| `src/pages/LeaderboardPage.tsx` | Kompakte Eventliste → Link zu HistoryPage |
| `src/pages/StatsPage.tsx` | Recharts, AccuracyBar, Fahrer-Prognose |
| `src/lib/resultProcessing.ts` | flatMap statt map+filter (TypeScript-Constraint) |
| `firestore.rules` | isAdmin-Check; lockedAt via `!('lockedAt' in resource.data)` |
| `src/contexts/ThemeContext.tsx` | Default `'carbon'`, localStorage überschreibt |
| `src/lib/teamColors.ts` | `getTeamColor(team: string): string` — alle 10 F1-Teams 2026 |
| `scripts/seed-prod.ts` | British GP Sprint-Q: `2026-07-03T15:30:00Z` (korrigiert von 16:30Z) |

## Code Context

**subscribeToAllTips** (firestore.ts — neu):
```typescript
export function subscribeToAllTips(cb: (tips: Tip[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'tips'), snap =>
    cb(snap.docs.map(d => d.data() as Tip))
  )
}
```

**LivePage Tipps-Card** — nach Live-Positionen-Card, vor Saisonstand-Card:
```typescript
// State
const [tips, setTips] = useState<Tip[]>([])
// Subscription (keyed on activeEvent?.id)
useEffect(() => {
  if (!activeEvent) { setTips([]); return }
  return subscribeToEventTips(activeEvent.id, setTips)
}, [activeEvent?.id])
// Filter
const sessionTips = tips.filter(t => t.sessionType === activeSessionType)
```

**HistoryPage Session-Start-Gate** (bereits vorhanden, kein Change nötig):
```typescript
const sessionStarted = sessionInfo ? sessionInfo.startTime.toDate() <= now : false
// ...
{!sessionStarted ? (
  <p className="text-f1-muted text-sm">Tipps werden nach Session-Start sichtbar</p>
) : (
  // Zeigt Tipps (mit Score-Breakdown falls vorhanden, sonst raw predictions)
)}
```

**OpenF1-Client Caches**:
```typescript
const _meetingsCache = new Map<number, Promise<OpenF1Meeting[]>>()
const _sessionsCache = new Map<number, Promise<OpenF1Session[]>>()
// Beide: p.catch(() => cache.delete(year)) → retry bei Fehler
```

**Firestore isAdmin** — manuell in Firebase Console setzen:
```
Firestore → users/{uid} → isAdmin: true
```

**TippableSessionType → EventSessionKey Mapping**:
```typescript
export const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}
```

## Resume Instructions

1. `npm run build` — sollte clean durchlaufen
2. `npm test` — 19/19 Tests grün
3. `git push origin main` — triggert GitHub Actions deploy.yml → GitHub Pages

Bei neuen Features: `npm run build` + `npm test` vor Commit.

## Setup Required

- `isAdmin: true` in Firestore `users/{uid}` manuell setzen
- GitHub Secrets für deploy.yml: `VITE_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT_KEY`
- Lokale Entwicklung: `VITE_USE_EMULATOR=true` in `.env.local`, dann `npm run emulators` + `npm run seed`

## Warnings

- **Tailwind v4**: Kein `tailwind.config.ts`. Custom-Farben in `src/index.css` via `@theme {}`.
- **`lockedAt` in Firestore Rules**: Nie `resource.data.lockedAt == null`. Immer `!('lockedAt' in resource.data)`.
- **OpenF1 Sprint vs Race**: Beide `session_type: "Race"` → slug-Matching schlägt fehl. `findOpenF1Session()` nutzt Zeit-basiertes Matching (±2h).
- **`src/assets/` und `tailwind.config.js`**: Ungetrackt, nicht committen.
- **Carbon-Textur auf Nav/Drawer**: Via `.carbon-surface` Klasse in `src/index.css`. Bei neuen Nav-Elementen nicht vergessen.
- **Git-Identität für dieses Repo**: `TyraBite / mcnt94@googlemail.com`. Kein `Co-Authored-By` in Commits.
- **seed-prod.ts British GP**: `fp3_or_sprint_q` auf `2026-07-03T15:30:00Z` (15:30 UTC = 17:30 CEST = 16:30 BST). War falsch als 16:30Z gespeichert.
- **Rangliste-Tab Tipps**: User will KEINE inline-Tips in der Rangliste. Compact-Liste → HistoryPage ist korrekt.
