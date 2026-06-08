# CLAUDE.md — Projektkontext für KI-Assistenten

Dieser File gibt dir als Claude (oder anderem KI-Assistenten) einen vollständigen Überblick über das Projekt, damit du ohne lange Einarbeitung direkt weiterarbeiten kannst.

---

## Was ist das hier?

Ein **Zweispieler-Tippspiel für Formel 1 2026**, gebaut für zwei Freunde (TyraBite und einen zweiten Spieler). Vor jeder tippbaren Session (Qualifying, Rennen, Sprint Qualifying, Sprint Race) gibt jeder Spieler seine Prognose für die Top 10 Fahrer ab. Nach der Session werden Punkte automatisch berechnet.

**Spielmodus:** Nur 2 Spieler. Kein öffentlicher Zugang, keine Registrierung. Nutzer werden direkt in Firebase angelegt.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript 6 |
| Styling | Tailwind CSS v4 (CSS-first, kein tailwind.config.ts) |
| Routing | React Router v7 |
| Backend | Firebase 12: Firestore + Auth (Email/Password) |
| Komponenten | @headlessui/react v2 (Combobox) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities |
| Tests | Vitest (Unit) + Playwright (E2E) |
| Hosting | GitHub Pages (`/f1-tipping-game/`) |
| Lokale Entwicklung | Firebase Emulator Suite |
| Seed-Script | Firebase Admin SDK (tsx) |

**Tailwind v4 Besonderheit:** Es gibt keine `tailwind.config.ts`. Farben werden in `src/index.css` mit `@theme {}` definiert. Klassen wie `bg-f1-red`, `text-f1-muted` etc. sind dort definiert.

---

## Projektstruktur

```
f1-tipping-game/
├── data/
│   └── season-2026.json          # 20 Fahrer der 2026-Saison
├── scripts/
│   └── seed.ts                   # Befüllt den lokalen Emulator (Admin SDK)
├── src/
│   ├── types/index.ts            # Alle TypeScript-Typen (Single Source of Truth)
│   ├── lib/
│   │   ├── firebase.ts           # Firebase-Init + Emulator-Erkennung
│   │   ├── firestore.ts          # Alle Firestore-Funktionen (CRUD + Subscriptions)
│   │   └── scoring.ts            # Reiner Scoring-Algorithmus (kein Firebase)
│   ├── contexts/
│   │   └── AuthContext.tsx       # React Context für Auth-State (ein onAuthStateChanged)
│   ├── hooks/
│   │   ├── useAuth.ts            # Liest aus AuthContext
│   │   ├── useTips.ts            # Tips laden/speichern für ein Event
│   │   └── useSessionResults.ts  # Echtzeit-Ergebnisse einer Session
│   ├── components/
│   │   ├── Layout.tsx            # Nav + Outlet-Wrapper
│   │   ├── DriverCombobox.tsx    # Suchbare Fahrer-Auswahl (forwardRef für Auto-Focus)
│   │   ├── TipForm.tsx           # 10-Positionen-Formular mit DnD-Sorting
│   │   ├── ReferenceTable.tsx    # Zeigt Vorrundenresultat als Tipp-Referenz
│   │   └── CountdownTimer.tsx    # Countdown bis Session-Start
│   ├── pages/
│   │   ├── LoginPage.tsx         # Username-Login (intern: username@f1tipping.local)
│   │   ├── HomePage.tsx          # Event-Liste + nächstes Event mit Countdown
│   │   ├── EventPage.tsx         # Tipp-Formular + Referenztabelle pro Session
│   │   ├── LeaderboardPage.tsx   # Gesamtpunkte + Head-to-Head
│   │   └── HistoryPage.tsx       # Tipp-Auflösung nach dem Rennen
│   ├── App.tsx                   # Router + AuthGuard
│   └── main.tsx
├── tests/
│   ├── unit/scoring.test.ts      # 7 Tests für den Scoring-Algorithmus
│   └── e2e/tipping.spec.ts
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
  id: 'bahrain_2026',
  round: 1,
  name: 'Bahrain Grand Prix',
  circuit: string,
  country: string,
  isSprintWeekend: boolean,
  sessions: {
    fp1?: SessionInfo,
    fp2?: SessionInfo,
    fp3_or_sprint_q?: SessionInfo,  // FP3 oder Sprint Qualifying (je nach Wochenende)
    qualifying: SessionInfo,
    sprint_race?: SessionInfo,
    race: SessionInfo,
  }
}
```

**`drivers`** — 20 Fahrer der Saison (aus `data/season-2026.json`)
```typescript
{ id: 'max_verstappen', code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', number: 1 }
```

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

**`session_results`** — Offizielle Ergebnisse (wird in Phase 2 automatisch befüllt)
```typescript
{
  id: '${eventId}_${sessionType}',
  eventId: string,
  sessionType: string,
  results: [{ position: 1, driverId: 'max_verstappen', driverCode: 'VER', driverName: '...' }],
  status: 'provisional' | 'official',
  fetchedAt: Timestamp,
  officialAt?: Timestamp,
}
```

**`scores`** — Berechnete Punkte (wird in Phase 2 nach Ergebnis-Import befüllt)
```typescript
{
  id: '${userId}_${eventId}_${sessionType}',
  userId, eventId, sessionType,
  points: number,
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
Das war nötig, weil die echten Werte im `.env.local` eine andere `projectId` als der Emulator hätten.

### Seed-Script (`scripts/seed.ts`)
Verwendet **Firebase Admin SDK** (nicht den Web-Client), weil der Admin SDK die Firestore Security Rules umgeht. Der Web-Client würde beim Schreiben ohne Auth geblockt werden.

```bash
npm run emulators   # Muss zuerst laufen
npm run seed        # Befüllt Fahrer, Events, Testnutzer, Session-Ergebnisse
```

**Wichtig:** Der Emulator speichert alles nur im RAM. Nach Neustart → `npm run seed` erneut ausführen.

### `.env.local` für Emulator-Entwicklung
Nur dieser Wert wird benötigt:
```
VITE_USE_EMULATOR=true
```
Alle `VITE_FIREBASE_*`-Werte sind für den Emulator irrelevant.

---

## Firestore Security Rules

Datei: `firestore.rules`

**Wichtige Besonderheit:** `lockedAt` ist ein optionales Feld (nicht immer in der Dokument). Deshalb:
- Kein `resource.data.lockedAt == null` (wirft "Property lockedAt is undefined")
- Stattdessen: `!('lockedAt' in resource.data)` und `resource.data.get('lockedAt', null)`

Lesezugriff auf Tips: eigene Tips immer lesbar. Fremde Tips nur wenn `lockedAt` gesetzt.

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

---

## Was noch NICHT gebaut ist (Phase 2)

- **Automatischer Ergebnis-Import:** `scripts/sync.ts` — OpenF1 API → Firestore → Punkteberechnung
- **Self-scheduling GitHub Action:** `event-sync.yml` — plant sich selbst rund um Race-Events
- **Live-Ansicht:** Echtzeit-View während des Rennens
- **Punkteberechnung-Trigger:** Läuft aktuell nicht automatisch — Scores müssen manuell in Firestore geschrieben werden

---

## Git & Commits

- Alle Commits unter `TyraBite` / `mcnt94@googlemail.com`
- **Kein** `Co-Authored-By` in Commit-Messages
- Deployment auf GitHub Pages via `.github/workflows/deploy.yml` bei Push auf `main`
- GitHub Actions Secrets für Firebase-Config (nicht `.env.local` committen!)
