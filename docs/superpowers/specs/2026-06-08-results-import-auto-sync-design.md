# Design: Results Import & Auto-Sync

**Date:** 2026-06-08  
**Status:** Approved

## Ziel

Rennergebnisse automatisch von der OpenF1 API holen, in Firestore speichern und Punkte für beide Spieler berechnen — ohne manuellen Aufwand nach dem Rennen. Zusätzlich ein manueller Button auf der AdminPage als On-Demand-Fallback.

## Scope

Alle tippbaren Session-Typen: `race`, `qualifying`, `sprint_race`, `sprint_qualifying`.  
Provisional-Ergebnisse werden sofort angezeigt und bei offizieller Bestätigung automatisch überschrieben.

---

## Architektur

### Komponenten

| Komponente | Zweck |
|---|---|
| `src/lib/syncResults.ts` | Client-seitige Sync-Logik (Web SDK, für AdminPage) |
| `src/pages/AdminPage.tsx` | Neuer "Ergebnisse importieren"-Button |
| `scripts/sync-results.ts` | Admin-SDK-Version derselben Logik (für GitHub Actions) |
| `.github/workflows/result-sync.yml` | Führt sync-results.ts aus |
| `.github/workflows/schedule-check.yml` | Täglicher Check, triggert result-sync.yml am Rennwochenende |
| `firestore.rules` | Lese-/Schreibrechte für `session_results` und `scores` |

`scoring.ts` bleibt **unverändert** — die Funktion `calculateScore()` wird direkt verwendet.

### Datenfluss

```
schedule-check.yml (täglich 06:00 UTC)
  → prüft Firestore events: Session endet in < 48h?
  → ja: gh workflow run result-sync.yml (stündlich, bis Wochenende vorbei)

result-sync.yml (on dispatch)
  → npm run sync:results
  → scripts/sync-results.ts
     → liest events aus Firestore (Admin SDK)
     → für jede tippbare, beendete Session ohne offizielles Ergebnis:
        → holt OpenF1 session_key
        → holt /position?session_key=X
        → berechnet finale Positionen (letzter Eintrag pro Fahrer)
        → mapped driver_number → driverId via drivers_YYYY
        → schreibt session_results/{eventId}_{sessionType}
        → liest alle tips mit eventId+sessionType
        → calculateScore() für jeden Tipp
        → schreibt scores/{userId}_{eventId}_{sessionType}

AdminPage-Button
  → syncResults(year) via src/lib/syncResults.ts (Web SDK, identische Logik)
```

---

## Session-Key Matching

OpenF1 liefert via `/sessions?year=Y` alle Sessions mit `session_key`, `location` und `session_type`.

Matching-Strategie:
1. OpenF1-Location slugifizieren: `"Monaco" → "monaco"`
2. Vergleich mit unserem Event-ID-Präfix: `"monaco_2026"` enthält `"monaco"` ✓
3. Session-Typ-Mapping (existiert bereits in `sync.ts`): `"Race" → "race"` etc.

Kein Match gefunden → Session überspringen, im Log festhalten.

---

## Fahrer-Mapping

OpenF1 `/position` gibt `driver_number` (integer). Wir brauchen `driverId` (string).

1. Lade `drivers_{year}` Collection aus Firestore: hat `number` (int), `code` (string), `id` (string)
2. Bau Map: `driver_number → driverId`
3. Finale Positionen: pro Fahrer letzten Eintrag nach `date` nehmen

---

## Smart Cron Design

### `schedule-check.yml`

- Trigger: täglich 06:00 UTC (cron)
- Liest Events aus Firestore
- Prüft: endet eine tippbare Session in den letzten 2h oder den nächsten 48h?
- Wenn ja: triggert `result-sync.yml` via `gh workflow run` stündlich für die Dauer des Wochenendes
- Token: eingebauter `GITHUB_TOKEN` reicht aus (kein extra Secret nötig)

### `result-sync.yml`

- Trigger: `workflow_dispatch` (durch schedule-check oder manuell)
- Führt `npm run sync:results` aus
- Idempotent: already-official Sessions werden übersprungen

### Provisional → Official Update

Beim nächsten Run wird ein vorhandenes `session_results`-Dokument mit `status: 'provisional'` überschrieben sobald OpenF1 offizielle Daten bereitstellt (erkennbar daran dass die Daten stabil sind / `date_end` der Session lange zurückliegt). Scores werden ebenfalls neu berechnet.

---

## Firestore Rules

Neue Regeln für `session_results` und `scores`:

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

Da nur zwei bekannte, vertrauenswürdige Nutzer existieren, ist `request.auth != null` ausreichend.

---

## Neue npm Scripts

```json
"sync:results": "tsx scripts/sync-results.ts"
```

---

## Nicht in Scope

- Live-Ansicht während laufender Sessions
- Push Notifications nach Ergebnisimport
- Mehrere Saisons gleichzeitig im Cron (nur aktuelles Jahr)
