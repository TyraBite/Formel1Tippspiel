# F1 Tipping Game 2026

Zweispieler-Tippspiel für die Formel-1-Saison 2026. Beide Spieler tippen jeweils die Top 10 Fahrer für jedes Qualifying, Rennen, Sprint Qualifying und Sprint Race – vor dem Start der Session.

**Punktewertung:** 1 Punkt für Fahrer korrekt in Top 10 · 3 Punkte für exakte Position · Max. 30 Punkte pro Session

---

## Design

F1-inspiriertes Dark-Theme. Designprinzipien:
- Roter 3px-Balken ganz oben (F1-Signature)
- Zweireihige Rennstreifen im Logo
- Aktive Nav-Links in F1-Rot, Nav-Text uppercase
- Cards leicht kantig (`rounded` statt `rounded-lg`)
- Buttons uppercase mit `tracking-wider` — wie Anzeigetafeln
- Badges eckig (`rounded-sm`), uppercase

---

## Lokale Entwicklung

### Voraussetzungen
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Java (für Firebase Emulator): `java -version` — JDK 11+ oder JDK 25 funktioniert

### Setup

1. **Klonen und installieren**
   ```bash
   git clone https://github.com/TyraBite/Formel1Tippspiel.git
   cd Formel1Tippspiel
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
   Öffne http://localhost:5173/Formel1Tippspiel/

   **Login:** Benutzername `spieler1` / Passwort `test1234`
   (oder `spieler2` / `test1234`)

> **Wichtig:** Der Emulator speichert alle Daten nur im RAM. Nach jedem Neustart des Emulators muss `npm run seed` erneut ausgeführt werden.

### Tests ausführen
```bash
npm test              # Unit-Tests (Scoring + processPositions)
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

## Admin-Seite

Die Seite `/Formel1Tippspiel/admin` ist nur per direkter URL erreichbar (kein Link in der Nav).

**Saison synchronisieren** — holt Events und Fahrer vom aktuellen und nächsten Jahr von der OpenF1 API.

**Ergebnisse importieren & Punkte berechnen** — holt Positionsdaten von OpenF1 für alle abgeschlossenen Sessions und berechnet die Scores beider Spieler.

---

## Ergebnisse manuell seeden (Scripts)

Für Scripts die auf die Produktions-DB schreiben wird der Firebase Service Account Key benötigt:

```bash
# Service Account Key von Firebase Console → Projekteinstellungen → Dienstkonten herunterladen
FIREBASE_SERVICE_ACCOUNT_KEY=$(cat serviceAccountKey.json) npm run sync:results
```

| Script | Zweck |
|---|---|
| `npm run seed:prod` | Produktions-DB mit Events und Fahrern befüllen |
| `npm run seed:tips-monaco` | Monaco 2026 Race Tips für beide Spieler seeden |
| `npm run sync:results` | Ergebnisse von OpenF1 holen + Scores berechnen |
| `npm run schedule:check` | Prüft ob aktuell Rennwochenende ist |

---

## Firebase Setup (Produktion)

1. [console.firebase.google.com](https://console.firebase.google.com) → Projekt erstellen
2. **Firestore** aktivieren (Produktionsmodus) und **Authentication** (E-Mail/Passwort)
3. Projektkonfiguration → Deine Apps → Web-App → Config-Werte kopieren
4. Als GitHub Secrets eintragen (siehe unten)

---

## GitHub Actions / Deployment

Jeder Push auf `main` löst automatisch ein Deployment auf GitHub Pages aus.

| Workflow | Trigger | Zweck |
|---|---|---|
| `deploy.yml` | Push auf `main` | Build + Firestore Rules + Seed + GitHub Pages |
| `seed-tips.yml` | Manuell (dispatch) | Seed-Scripts manuell auslösen |
| `result-sync.yml` | Manuell (dispatch) | Ergebnisse von OpenF1 holen + Scores berechnen |
| `schedule-check.yml` | Alle 5 min Mo/Fr/Sa/So | Session-Fenster prüfen, result-sync auslösen |

**Sync-Logik:** `schedule-check` triggert `result-sync` wenn eine tippbare Session in den letzten 90 min endete oder in den nächsten 30 min endet — so starten Polls kurz vor dem erwarteten Session-Ende und laufen bis die Ergebnisse stabil sind.

**Benötigte GitHub Secrets** (Settings → Secrets → Actions):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON des Service Accounts (Firestore Rules Deploy + Seed + Sync)
