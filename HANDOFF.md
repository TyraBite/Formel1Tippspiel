# Handoff: F1 Tippspiel — Feature Sprint

**Generated**: 2026-07-03
**Branch**: main (1 commit ahead of origin — push to deploy)
**Status**: In Progress (active development, all features working)

## Goal

Zweispieler-F1-Tippspiel (React + Vite + Firebase + Tailwind v4, deployed auf GitHub Pages). Laufende Feature-Erweiterungen und UX-Verbesserungen nach einer größeren Feature-Phase.

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

## Not Yet Done

- [ ] Push Notifications (bewusst zurückgestellt — Nutzer entschied "vorerst nicht")
- [ ] Deployment: letzter Commit noch nicht gepusht (`git push` ausstehend)

## Failed Approaches (Don't Repeat These)

**Recharts Tooltip TypeScript**: `formatter={(value: number, name: string)}` schlägt fehl weil Recharts `ValueType | undefined` übergibt. Fix: `String(value)` + `String(name)`, `labelFormatter` via `(_, payload) => payload?.[0]?.payload?.name ?? ''`.

**resultProcessing.ts flatMap**: `map` + `filter` mit Type-Predicate erzeugt `true | undefined` statt `boolean | undefined`. Fix: `flatMap` mit expliziter `const result: DriverResult = {...}` Annotation.

**Firestore lockedAt-Check**: `resource.data.lockedAt == null` wirft "Property lockedAt is undefined". Korrekt: `!('lockedAt' in resource.data)`.

**OpenF1 Rate-Limiting**: Mehrere parallele Aufrufe von `openf1.sessions(year)` lösen Rate-Limit aus. Fix: Module-level `_sessionsCache: Map<number, Promise<OpenF1Session[]>>` — alle Aufrufe teilen sich eine Promise.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| `isAdmin` Feld in Firestore `users`-Doc | Muss manuell in Firebase Console gesetzt werden; kein Auto-Deploy |
| Carbon als Default-Theme | Nutzer-Präferenz; `night-race` bleibt als Alternative |
| "Live" bleibt englisch | Internationaler F1-Begriff, kein passendes deutsches Äquivalent |
| Burger auf allen Screens (Mobile: nur Burger, Desktop: Burger + Horizontal-Nav) | Mobile-first; konsistenter Entry-Point |
| Fahrer-Prognose zeigt alle Fahrer (kein slice) | Nutzer wollte vollständige Liste |
| Pit stop duration = `stop_duration ?? pit_duration` | `stop_duration` (stationary ~2-3s) informativer als `pit_duration` (volle Pitlane ~21s) |

## Current State

**Working**: Alle Features funktionieren. Build sauber. 19/19 Tests grün.

**Uncommitted Changes**: `README.md` modifiziert (nicht kritisch), `src/assets/` und `tailwind.config.js` ungetrackt (auto-generiert, nicht committen).

**Ausstehend**: `git push origin main` zum Deployen auf GitHub Pages (deploy.yml triggert bei Push auf main).

## Files to Know

| File | Why It Matters |
|------|----------------|
| `src/components/Layout.tsx` | Burger-Drawer, Body-Scroll-Lock, carbon-surface Klasse auf Nav+Drawer |
| `src/index.css` | Tailwind v4 CSS-first: `@theme {}` für Variablen, `[data-theme="carbon"]` Override, `.carbon-surface` Klasse |
| `src/lib/openf1.ts` | Alle OpenF1-Interfaces + `openf1.*` Methoden; `_sessionsCache` für Rate-Limit |
| `src/pages/LivePage.tsx` | Live-Session-Erkennung, Polling-Effekte (15s/30s/60s), Compound/Gap/Pit-Daten |
| `src/pages/StatsPage.tsx` | Recharts LineChart, driverProfiles useMemo, AccuracyBar Komponente |
| `src/lib/resultProcessing.ts` | `processSessionResults()` — flatMap statt map+filter (TypeScript-Constraint) |
| `firestore.rules` | isAdmin-Check für Tip-Updates; lockedAt-Prüfung via `!('lockedAt' in resource.data)` |
| `src/contexts/ThemeContext.tsx` | Default `'carbon'`, localStorage überschreibt |
| `src/lib/teamColors.ts` | `getTeamColor(team: string): string` — alle 10 F1-Teams 2026 |

## Code Context

**Theme-System** (Tailwind v4, CSS-first):
```css
/* src/index.css */
@theme {
  --color-f1-red: #E8002D;
  --color-f1-dark: #15151E;
  --color-f1-card: #1E1E2E;
  /* ... */
}
[data-theme="carbon"] {
  --color-f1-red: #FF1801;
  --color-f1-dark: #000000;
  --color-f1-card: #0d0d0d;
  --color-f1-border: #242424;
}
/* Tailwind-Klassen: bg-f1-dark, text-f1-muted, border-f1-border etc. */
/* .carbon-surface: Weave-Textur auf Nav-Bar und Burger-Drawer */
```

**OpenF1-Client** (neu: intervals, stints, pits):
```typescript
export const openf1 = {
  weather: (sessionKey: number) => get<OpenF1Weather>(`/weather?session_key=${sessionKey}`, true),
  raceControl: (sessionKey: number) => get<OpenF1RaceControl>(`/race_control?session_key=${sessionKey}`, true),
  intervals: (sessionKey: number) => get<OpenF1Interval>(`/intervals?session_key=${sessionKey}`, true),
  stints: (sessionKey: number) => get<OpenF1Stint>(`/stints?session_key=${sessionKey}`, true),
  pits: (sessionKey: number) => get<OpenF1Pit>(`/pit?session_key=${sessionKey}`, true),
}
// OpenF1Interval: { driver_number, date, gap_to_leader: number|string|null, interval: number|string|null }
// OpenF1Stint:    { driver_number, stint_number, compound, lap_start, lap_end: number|null }
// OpenF1Pit:      { driver_number, lap_number, pit_duration: number|null, stop_duration: number|null }
```

**Firestore isAdmin** — muss manuell in Firebase Console gesetzt werden:
```
Firestore → users/{uid} → isAdmin: true
```
Ist NICHT im Deploy-Script enthalten. Kein Auto-Deploy.

**TippableSessionType → EventSessionKey Mapping**:
```typescript
// src/lib/useLivePositions.ts
export const TIPPABLE_TO_EVENT_SESSION: Record<TippableSessionType, keyof F1Event['sessions']> = {
  qualifying: 'qualifying',
  race: 'race',
  sprint_race: 'sprint_race',
  sprint_qualifying: 'fp3_or_sprint_q',
}
```

**Driver.number** (für OpenF1-Lookup in LivePage):
```typescript
// src/types/index.ts
interface Driver { id: string; code: string; name: string; team: string; number: number }
// Lookup: drivers.find(d => d.id === dr.driverId)?.number → driver_number für OpenF1
```

## Resume Instructions

1. `npm run build` — sollte clean durchlaufen (keine TypeScript-Fehler)
2. `npm test` — 19/19 Tests sollten grün sein
3. `git push origin main` — triggert GitHub Actions deploy.yml → GitHub Pages

Bei neuen Features immer `npm run build` + `npm test` vor Commit.

## Setup Required

- `isAdmin: true` in Firestore `users/{uid}` manuell setzen für Admin-Nutzer
- GitHub Secrets für deploy.yml: `VITE_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT_KEY`
- Lokale Entwicklung: `VITE_USE_EMULATOR=true` in `.env.local`, dann `npm run emulators` + `npm run seed`

## Warnings

- **Tailwind v4**: Kein `tailwind.config.ts`. Alle Custom-Farben in `src/index.css` via `@theme {}`. Ungetrackte `tailwind.config.js` im Repo-Root ignorieren (auto-generiert, nicht relevant).
- **`lockedAt` in Firestore Rules**: Nie `resource.data.lockedAt == null` — wirft Fehler. Immer `!('lockedAt' in resource.data)`.
- **OpenF1 Sprint vs Race**: Beide heißen `session_type: "Race"` in OpenF1 → slug-Matching schlägt fehl. `findOpenF1Session()` nutzt Zeit-basiertes Matching (±2h).
- **`src/assets/` und `tailwind.config.js`**: Ungetrackt, nicht committen.
- **Carbon-Textur auf Nav/Drawer**: Via `.carbon-surface` Klasse in `src/index.css`. Wenn Nav oder Drawer neu erstellt werden, `carbon-surface` Klasse nicht vergessen.
- **Git-Identität für dieses Repo**: `TyraBite / mcnt94@googlemail.com`. Kein `Co-Authored-By` in Commits.
