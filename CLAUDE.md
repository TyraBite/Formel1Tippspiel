# CLAUDE.md — Projektkontext für KI-Assistenten

Dieser File gibt dir als Claude (oder anderem KI-Assistenten) einen vollständigen Überblick über das Projekt, damit du ohne lange Einarbeitung direkt weiterarbeiten kannst.

---

## Was ist das hier?

Ein **Zweispieler-Tippspiel für Formel 1 2026**, gebaut für zwei Freunde (TyraBite und einen zweiten Spieler). Vor jeder tippbaren Session (Qualifying, Rennen, Sprint Qualifying, Sprint Race) gibt jeder Spieler seine Prognose für die Top 10 Fahrer ab. Nach der Session werden Punkte automatisch berechnet.

**Spielmodus:** Nur 2 Spieler. Kein öffentlicher Zugang, keine Registrierung. Nutzer werden direkt in Firebase angelegt.

**Live:** https://tyrabite.github.io/Formel1Tippspiel/

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript 6 |
| Styling | Tailwind CSS v4 (CSS-first, kein tailwind.config.ts) |
| Routing | React Router v7, BrowserRouter mit `basename="/Formel1Tippspiel"` |
| Backend | Firebase 12: Firestore + Auth (Email/Password) |
| Komponenten | @headlessui/react v2 (Combobox) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities |
| Tests | Vitest (Unit) + Playwright (E2E) |
| Hosting | GitHub Pages (`/Formel1Tippspiel/`) |
| Lokale Entwicklung | Firebase Emulator Suite |
| Seed-Scripts | Firebase Admin SDK (tsx) |
| Externe API | OpenF1 API (api.openf1.org/v1) — Saison- und Ergebnisdaten |

**Tailwind v4 Besonderheit:** Es gibt keine `tailwind.config.ts`. Farben werden in `src/index.css` mit `@theme {}` definiert. Klassen wie `bg-f1-red`, `text-f1-muted` etc. sind dort definiert.

---

## Projektstruktur

```
f1-tipping-game/
├── data/
│   └── season-2026.json          # 20 Fahrer der 2026-Saison (Fallback/Seed-Basis)
├── scripts/
│   ├── seed.ts                   # Befüllt den lokalen Emulator (Admin SDK)
│   ├── seed-prod.ts              # Befüllt die Produktions-DB (22 Events, Fahrer 2026)
│   ├── seed-tips-monaco.ts       # Manuelle Tips für Monaco 2026 seeden
│   ├── sync-results.ts           # Ergebnisse von OpenF1 holen + Scores berechnen (Admin SDK)
│   └── schedule-check.ts         # Prüft ob Rennwochenende und setzt GITHUB_OUTPUT
├── src/
│   ├── types/index.ts            # Alle TypeScript-Typen (Single Source of Truth)
│   ├── lib/
│   │   ├── firebase.ts           # Firebase-Init + Emulator-Erkennung
│   │   ├── firestore.ts          # Alle Firestore-Funktionen (CRUD + Subscriptions)
│   │   ├── scoring.ts            # Reiner Scoring-Algorithmus (kein Firebase)
│   │   ├── resultProcessing.ts   # Pure Funktion: OpenF1-Positionsdaten → DriverResult[]
│   │   ├── sync.ts               # Saison-Sync: OpenF1-Meetings/Sessions → Firestore events
│   │   └── syncResults.ts        # Ergebnis-Sync: OpenF1-Positionen → session_results + scores
│   ├── contexts/
│   │   └── AuthContext.tsx       # React Context für Auth-State (ein onAuthStateChanged)
│   ├── hooks/
│   │   ├── useAuth.ts            # Liest aus AuthContext
│   │   ├── useTips.ts            # Tips laden/speichern für ein Event
│   │   └── useSessionResults.ts  # Echtzeit-Ergebnisse einer Session
│   ├── components/
│   │   ├── Layout.tsx            # Nav + Outlet-Wrapper
│   │   ├── DriverCombobox.tsx    # Suchbare Fahrer-Auswahl (forwardRef, Dropdown-Richtungserkennung)
│   │   ├── TipForm.tsx           # 10-Positionen-Formular mit DnD-Sorting
│   │   ├── ReferenceTable.tsx    # Zeigt Vorrundenresultat als Tipp-Referenz
│   │   └── CountdownTimer.tsx    # Countdown bis Session-Start
│   ├── pages/
│   │   ├── LoginPage.tsx         # Username-Login (intern: username@f1tipping.local)
│   │   ├── HomePage.tsx          # Event-Liste + nächstes Event mit Countdown
│   │   ├── EventPage.tsx         # Tipp-Formular + Referenztabelle pro Session
│   │   ├── LeaderboardPage.tsx   # Gesamtpunkte + Head-to-Head
│   │   ├── HistoryPage.tsx       # Tipp-Auflösung nach dem Rennen
│   │   └── AdminPage.tsx         # /admin — Saison-Sync + Ergebnis-Import (versteckt, nur URL)
│   ├── App.tsx                   # Router + AuthGuard
│   └── main.tsx
├── tests/
│   ├── unit/
│   │   ├── scoring.test.ts       # Tests für den Scoring-Algorithmus
│   │   └── syncResults.test.ts   # Tests für processPositions
│   └── e2e/tipping.spec.ts
├── .github/workflows/
│   ├── deploy.yml                # Push auf main → Build + Rules + Seed + GitHub Pages
│   ├── seed-tips.yml             # Manueller Trigger für Seed-Scripts (workflow_dispatch)
│   ├── result-sync.yml           # Stündlich Fr/Sa/So + dispatch → sync:results
│   └── schedule-check.yml        # Täglich 06:00 UTC → prüft Rennwochenende, triggert result-sync
├── docs/superpowers/
│   ├── specs/                    # Design-Specs (Brainstorming-Output)
│   └── plans/                    # Implementierungspläne
├── firebase.json                 # Emulator-Konfiguration
├── firestore.rules               # Security Rules
└── .env.local.example
```

---

## Firestore Datenmodell

### Collections

**`events`** — F1-Rennwochenenden
```typescript
{
  id: 'monaco_2026',             // toSlug(location)_year
  round: 8,
  name: 'Monaco Grand Prix',
  circuit: string,
  country: string,
  isSprintWeekend: boolean,
  sessions: {
    fp1?: SessionInfo,
    fp2?: SessionInfo,
    fp3_or_sprint_q?: SessionInfo,  // FP3 normal WE | Sprint Qualifying auf Sprint WE
    qualifying: SessionInfo,
    sprint_race?: SessionInfo,
    race: SessionInfo,
  }
}
```

**`drivers_YYYY`** — Fahrer pro Saison (z.B. `drivers_2026`, `drivers_2027`)
```typescript
{ id: 'max_verstappen', code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', number: 1 }
```
Pro-Saison-Collections für historische Korrektheit. `getDrivers(year)` liest aus `drivers_${year}`.

**`tips`** — Tipps der Spieler
```typescript
{
  id: '${userId}_${eventId}_${sessionType}',
  userId: string,
  eventId: string,
  sessionType: 'qualifying' | 'race' | 'sprint_qualifying' | 'sprint_race',
  predictions: { "1": "max_verstappen", "2": "lando_norris", ..., "10": "..." },
  updatedAt: Timestamp,
  lockedAt?: Timestamp,   // NICHT gesetzt = noch editierbar
}
```

**`session_results`** — Ergebnisse nach dem Rennen
```typescript
{
  id: '${eventId}_${sessionType}',   // z.B. 'monaco_2026_race'
  eventId: string,
  sessionType: string,
  results: [{ position: 1, driverId: 'max_verstappen', driverCode: 'VER', driverName: '...' }],
  status: 'provisional' | 'official',   // provisional < 3h nach Session-Ende, dann official
  fetchedAt: Timestamp,
  officialAt?: Timestamp,
}
```

**`scores`** — Berechnete Punkte
```typescript
{
  id: '${userId}_${eventId}_${sessionType}',
  userId, eventId, sessionType,
  points: number,                  // 0–30
  breakdown: [{ pos, predictedDriverId, actualDriverId, points }],
  isProvisional: boolean,
  calculatedAt: Timestamp,
}
```

**`users`** — Spielerprofile
```typescript
{ id: string, email: string, displayName: string }
```

---

## Scoring-Algorithmus

Datei: `src/lib/scoring.ts` — pure Funktion, kein Firebase.

```
Für jede der 10 vorhergesagten Positionen:
  - Fahrer exakt auf dieser Position → 3 Punkte
  - Fahrer irgendwo in Top 10, aber falsche Position → 1 Punkt
  - Fahrer gar nicht in Top 10 → 0 Punkte
Maximum: 30 Punkte pro Session
```

---

## Ergebnis-Import & Score-Berechnung

### Wie es funktioniert

1. **OpenF1 API** (`/position?session_key=X`) liefert alle Positionsänderungen einer Session.
2. `processPositions()` (`src/lib/resultProcessing.ts`) nimmt den letzten Eintrag pro Fahrer als Endergebnis.
3. Driver-Mapping: `driver_number` (OpenF1) → `driverId` via `drivers_YYYY` Collection.
4. Session-Matching: `toSlug(meeting.location)_year_sessionType` = `eventId_sessionType`.
5. Nach `session_results` schreiben → für alle Tips `calculateScore()` → `scores` schreiben.

### Tippable Sessions → Event-Session-Key Mapping

| TippableSessionType | Event-Sessions-Key |
|---|---|
| `qualifying` | `qualifying` |
| `race` | `race` |
| `sprint_race` | `sprint_race` |
| `sprint_qualifying` | `fp3_or_sprint_q` |

### Provisional vs. Official

Ergebnis wird als `provisional` gespeichert wenn die Session < 3h zurückliegt. Beim nächsten Sync-Lauf wird auf `official` aktualisiert und der Score neu berechnet.

### Trigger

- **AdminPage-Button** (`/admin` → "Ergebnisse importieren") — on-demand, Web SDK
- **GitHub Action `result-sync.yml`** — stündlich Fr/Sa/So UTC, Admin SDK
- **GitHub Action `schedule-check.yml`** — täglich 06:00 UTC, triggert `result-sync.yml` wenn Session in den nächsten 48h oder den letzten 2h endet

---

## Admin Page (`/Formel1Tippspiel/admin`)

Nur per direkter URL erreichbar. Kein Link in der Navigation.

**Saison synchronisieren:** Holt Meetings, Sessions und Fahrer vom aktuellen und nächsten Jahr von OpenF1. Schreibt in `events` und `drivers_YYYY`.

**Ergebnisse importieren & Punkte berechnen:** Holt für alle abgeschlossenen tippbaren Sessions die Positionsdaten von OpenF1, schreibt `session_results` und berechnet `scores` für alle Tips.

---

## Auth & Login

- Firebase Email/Password Auth
- **Login-UI**: Nur Benutzername (kein @-Zeichen). Intern wird `username@f1tipping.local` als E-Mail an Firebase übergeben.
- Nutzer werden manuell in Firebase Console angelegt (keine Registrierung)
- `AuthContext` hält den Auth-State mit einem einzigen `onAuthStateChanged` (verhindert doppelte Subscriptions bei Hot-Reload)

**Emulator-Testnutzer:**
- `spieler1` / `test1234`
- `spieler2` / `test1234`

---

## Lokale Entwicklung — Wichtige Details

### Emulator-Konfiguration
`firebase.json` definiert: Auth :9099, Firestore :8080, UI :4000

### firebase.ts — Emulator-Erkennung
Wenn `VITE_USE_EMULATOR=true`, wird **hardcoded Demo-Config** verwendet (ignoriert alle anderen `.env.local`-Werte):
```typescript
const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
const app = initializeApp(isEmulator ? {
  projectId: 'demo-f1-tipping',
  apiKey: 'demo-key',
  authDomain: 'demo-f1-tipping.firebaseapp.com',
} : { /* echte Werte aus .env.local */ })
```

### Seed-Scripts

Alle Scripts verwenden **Firebase Admin SDK** (umgeht Security Rules):

```bash
npm run emulators          # Emulator starten (Terminal 1)
npm run seed               # Emulator mit Testdaten befüllen

npm run seed:prod          # Produktions-DB: Events + Fahrer 2026 (braucht FIREBASE_SERVICE_ACCOUNT_KEY)
npm run seed:tips-monaco   # Monaco 2026 Race Tips manuell seeden
npm run sync:results       # Ergebnisse von OpenF1 holen + Scores berechnen
npm run schedule:check     # Prüft ob Rennwochenende (setzt GITHUB_OUTPUT wenn in CI)
```

Für `seed:prod`, `sync:results`, `schedule:check`:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=$(cat serviceAccountKey.json) npm run sync:results
```

**Wichtig:** Der Emulator speichert alles nur im RAM. Nach Neustart → `npm run seed` erneut ausführen.

### `.env.local` für Emulator-Entwicklung
Nur dieser Wert wird benötigt:
```
VITE_USE_EMULATOR=true
```
Alle `VITE_FIREBASE_*`-Werte sind für den Emulator irrelevant.

---

## GitHub Actions

| Workflow | Trigger | Zweck |
|---|---|---|
| `deploy.yml` | Push auf `main` | Build → Firestore Rules → Seed Prod → GitHub Pages |
| `seed-tips.yml` | `workflow_dispatch` | Manuelle Seed-Scripts auslösen |
| `result-sync.yml` | Stündlich Fr/Sa/So + dispatch | `sync:results` ausführen |
| `schedule-check.yml` | Täglich 06:00 UTC | Rennwochenende prüfen, `result-sync.yml` triggern |

**Benötigte GitHub Secrets:**
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON des Firebase Service Accounts (für Seed + Rules Deploy + Sync)

---

## Firestore Security Rules

Datei: `firestore.rules`

**Wichtige Besonderheit:** `lockedAt` ist ein optionales Feld. Deshalb:
- Kein `resource.data.lockedAt == null` (wirft "Property lockedAt is undefined")
- Stattdessen: `!('lockedAt' in resource.data)`

Schreibrechte:
- `events`, `drivers_*`, `session_results`, `scores` — jeder authentifizierte Nutzer (beide Spieler = vertrauenswürdig)
- `tips` — nur eigene Tips, nur wenn noch nicht gesperrt (`lockedAt` nicht gesetzt)
- `users` — nur eigenes Dokument

---

## Komponenten — wichtige Details

### TipForm (`src/components/TipForm.tsx`)
- State: `slots: Slot[]` (Array von `{ key, driverId }`) als primäre Wahrheit statt `predictions: Record`
- DnD: `@dnd-kit/sortable` mit `arrayMove` — Drag-Handle links neben jeder Zeile
- Auto-Focus: Nach Fahrerauswahl (Enter) wird automatisch die nächste Combobox fokussiert
- Reset-Logik: `tipLoadKey` (Session + Inhalt der Prognosen) als `useEffect`-Dependency, nicht nur `existingTip?.id` — sonst werden Tipps beim Tab-Wechsel nicht zuverlässig neu geladen

### DriverCombobox (`src/components/DriverCombobox.tsx`)
- `forwardRef` → Input-Ref wird an TipForm weitergegeben (für Auto-Focus)
- `immediate` Prop an `<Combobox>` → Dropdown öffnet beim Klick ohne Tippen
- `onClose={() => setQuery('')}` → Query-State beim Schließen zurücksetzen
- Dropdown-Richtungserkennung: `getBoundingClientRect()` prüft ob genug Platz nach unten, sonst `bottom-full` (nach oben öffnen)

---

## SPA Routing auf GitHub Pages

`public/404.html` fängt 404-Requests ab und speichert die Route in `sessionStorage`. `index.html` liest diese beim Start und restored die Route via `window.history.replaceState`.

---

## Git & Commits

- Alle Commits unter `TyraBite` / `mcnt94@googlemail.com`
- **Kein** `Co-Authored-By` in Commit-Messages
- Deployment auf GitHub Pages via `.github/workflows/deploy.yml` bei Push auf `main`
- GitHub Actions Secrets für Firebase-Config (nicht `.env.local` oder `serviceAccountKey.json` committen!)
