# F1 Tipping Game 2026

Zweispieler-Tippspiel für die Formel-1-Saison 2026. Beide Spieler tippen jeweils die Top 10 Fahrer für jedes Qualifying, Rennen, Sprint Qualifying und Sprint Race – vor dem Start der Session.

**Punktewertung:** 1 Punkt für Fahrer korrekt in Top 10 · 3 Punkte für exakte Position · Max. 30 Punkte pro Session

**Live:** https://tyrabite.github.io/f1-tipping-game/

---

## Lokale Entwicklung

### Voraussetzungen
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Java (für Firebase Emulator): `java -version` — JDK 11+ oder JDK 25 funktioniert

### Setup

1. **Klonen und installieren**
   ```bash
   git clone https://github.com/TyraBite/f1-tipping-game.git
   cd f1-tipping-game
   npm install
   ```

2. **Env-Datei anlegen**
   ```bash
   cp .env.local.example .env.local
   # Für reine Emulator-Entwicklung reicht:
   # VITE_USE_EMULATOR=true
   # Alle anderen VITE_FIREBASE_* Werte werden im Emulator-Modus ignoriert
   ```

3. **Emulator starten und Testdaten laden**
   ```bash
   # Terminal 1
   npm run emulators

   # Terminal 2 (sobald Emulator bereit ist)
   npm run seed
   ```

4. **Dev-Server starten**
   ```bash
   npm run dev
   ```
   Öffne http://localhost:5173/f1-tipping-game/

   **Login:** Benutzername `spieler1` / Passwort `test1234`
   (oder `spieler2` / `test1234`)

> **Wichtig:** Der Emulator speichert alle Daten nur im RAM. Nach jedem Neustart des Emulators muss `npm run seed` erneut ausgeführt werden.

### Tests ausführen
```bash
npm test              # Unit-Tests (Scoring-Algorithmus)
npm run test:e2e      # E2E-Tests (benötigt laufenden Dev-Server)
```

---

## Neuen Nutzer anlegen (Produktion)

Da der Login mit Username statt E-Mail funktioniert, werden Nutzer direkt in der Firebase Console angelegt:

1. Firebase Console → Authentication → Users → "Add user"
2. E-Mail: `<benutzername>@f1tipping.local` (z.B. `max@f1tipping.local`)
3. Passwort frei wählen
4. Firestore → Collection `users` → Dokument mit der UID anlegen:
   ```json
   { "id": "<uid>", "email": "max@f1tipping.local", "displayName": "Max" }
   ```

---

## Firebase Setup (Produktion)

1. [console.firebase.google.com](https://console.firebase.google.com) → Projekt erstellen
2. **Firestore** aktivieren (Produktionsmodus) und **Authentication** (E-Mail/Passwort)
3. Projektkonfiguration → Deine Apps → Web-App → Config-Werte kopieren
4. Als GitHub Secrets eintragen (siehe unten)

### Firestore Rules deployen
```bash
firebase deploy --only firestore:rules
```

---

## GitHub Actions / Deployment

Jeder Push auf `main` löst automatisch ein Deployment auf GitHub Pages aus.

**Benötigte GitHub Secrets** (Settings → Secrets → Actions):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---

## Phase 2 (geplant)

- `scripts/sync.ts` — OpenF1-API → Firestore Ergebnisse + Punkteberechnung
- `scripts/schedule-update.ts` — Jolpica-Kalender → Self-updating Cron in `event-sync.yml`
- `.github/workflows/event-sync.yml` — Self-scheduling Sync-Job
- Live-Ansicht während des Rennens
