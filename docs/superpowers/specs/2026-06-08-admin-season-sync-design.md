# Admin Season Sync — Design Spec

## Übersicht

Eine `/admin`-Seite in der App mit einem Sync-Button, der Fahrer und Events direkt aus der OpenF1 API in Firestore schreibt. Kein Backend nötig — der Browser ruft die öffentliche OpenF1 API ab und schreibt über das Firebase Client SDK.

Ziel: Die App funktioniert automatisch für jede neue Saison, ohne manuelles Seeden oder Code-Änderungen.

---

## Datenmodell-Änderungen

### Fahrer: per-Saison Collections

Statt einer globalen `drivers`-Collection gibt es pro Saison eine eigene:

- `drivers_2026` — Fahrer der Saison 2026
- `drivers_2027` — Fahrer der Saison 2027
- etc.

Driver-IDs bleiben saisonübergreifend stabil (`max_verstappen`). Team und Nummer können sich pro Saison unterscheiden und sind korrekt in der jeweiligen Saison-Collection hinterlegt.

**Migration:** `seed-prod.ts` schreibt Fahrer künftig in `drivers_2026`. Die alte `drivers`-Collection bleibt als verwaiste Daten in Firestore (harmlos, wird nicht mehr abgefragt).

### Events: unverändert

Events sind bereits jahres-spezifisch durch ihren ID (`australia_2026`). Keine Strukturänderung nötig.

---

## Neue Dateien

### `src/lib/openf1.ts`

OpenF1 API-Client. Drei Funktionen:

```typescript
fetchMeetings(year: number): Promise<OpenF1Meeting[]>
fetchSessions(year: number): Promise<OpenF1Session[]>
fetchDrivers(sessionKey: number): Promise<OpenF1Driver[]>
```

Basis-URL: `https://api.openf1.org/v1`

OpenF1-Typen (vereinfacht):
```typescript
type OpenF1Meeting = {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  circuit_short_name: string
  date_start: string
  year: number
}

type OpenF1Session = {
  session_key: number
  session_name: string
  session_type: string   // "Practice 1" | "Practice 2" | "Practice 3" | "Qualifying" | "Sprint Qualifying" | "Sprint" | "Race"
  date_start: string
  date_end: string
  meeting_key: number
  year: number
}

type OpenF1Driver = {
  driver_number: number
  full_name: string      // "Lando NORRIS" — letzter Name in Großbuchstaben
  name_acronym: string   // "NOR"
  team_name: string
  session_key: number
}
```

### `src/lib/sync.ts`

Mapping-Logik und Firestore-Schreiboperationen.

**Session-Typ-Mapping:**

| OpenF1 `session_type` | Firestore-Feld | Kontext |
|---|---|---|
| `"Practice 1"` | `fp1` | beide Weekendtypen |
| `"Practice 2"` | `fp2` | nur Non-Sprint |
| `"Practice 3"` | `fp3_or_sprint_q` | Non-Sprint |
| `"Sprint Qualifying"` | `fp3_or_sprint_q` | Sprint-Weekend |
| `"Sprint"` | `sprint_race` | Sprint-Weekend |
| `"Qualifying"` | `qualifying` | beide |
| `"Race"` | `race` | beide |

**Sprint-Weekend-Erkennung:** Meeting enthält eine Session mit `session_type === "Sprint"`.

**Status-Erkennung:** `new Date(session.date_end) < new Date()` → `"official"`, sonst `"upcoming"`.

**Event-ID-Schema:** `{country_slug}_{year}`, z.B. `australia_2026`. Country-Name wird lowercase + Sonderzeichen entfernt.

**Driver-Normalisierung:** `"Lando NORRIS"` → `"Lando Norris"` (letztes Wort title-cased). Driver-ID: alle Wörter lowercase, Leerzeichen durch `_` ersetzt.

**Haupt-Funktion:**

```typescript
syncSeason(year: number): Promise<SyncResult>
```

Logik:
1. Meetings + Sessions für `year` von OpenF1 holen
2. Vorhandene Event-IDs für `year` aus Firestore lesen
3. Für neue Events: vollständig schreiben
4. Für bestehende Events: nur Session-Status-Felder updaten (kein Überschreiben von Zeitplänen)
5. Fahrer: nur schreiben wenn `drivers_${year}` noch keine Dokumente hat
6. Fahrer aus erster Race-Session des Jahres holen (falls vorhanden)

```typescript
type SyncResult = {
  eventsAdded: number
  eventsUpdated: number
  driversAdded: number
  year: number
  error?: string
}
```

**Jahres-Logik in `AdminPage`:**
- Aktuelles Jahr prüfen
- Wenn alle Race-Sessions des aktuellen Jahres `"official"` → auch `year + 1` syncen
- Beide Jahre parallel syncen falls nötig

### `src/pages/AdminPage.tsx`

Einfache Seite, kein Link in der Navigation. Inhalte:

- Überschrift "Admin"
- Button "Saison synchronisieren"
- Während Sync: Spinner + "Synchronisiere..."
- Erfolg: "Saison YYYY: X Events hinzugefügt, Y aktualisiert, Z Fahrer importiert"
- Fehler: Fehlermeldung mit Details

---

## Geänderte Dateien

### `src/lib/firestore.ts`

- `getDrivers()` → `getDrivers(year: number)` — liest aus `drivers_${year}` statt `drivers`

### `src/pages/EventPage.tsx`

- Jahr aus `eventId` ableiten: `eventId.match(/\d{4}/)?.[0]` → `2026`
- An `getDrivers(year)` übergeben

### `src/App.tsx`

- Route `/admin` hinzufügen, hinter `AuthGuard`

### `scripts/seed-prod.ts`

- Fahrer in `drivers_2026` statt `drivers` schreiben

### `firestore.rules`

Schreib-Rechte für Events und Fahrer-Collections für eingeloggte User.

Firestore Rules unterstützen keine Wildcards in Collection-Namen. Stattdessen wird ein Collection-Level-Wildcard mit `.matches()` verwendet:

```
match /events/{id} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
// Trifft auf drivers_2026, drivers_2027, etc.
match /{driversCol}/{id} {
  allow read: if request.auth != null && driversCol.matches('drivers_[0-9]+');
  allow write: if request.auth != null && driversCol.matches('drivers_[0-9]+');
}
```

---

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| OpenF1 nicht erreichbar | Fehlermeldung in UI, Firestore unverändert |
| Saison noch nicht in OpenF1 (z.B. Jan vor Saisonstart) | Leeres Ergebnis, keine Änderungen, Info-Meldung |
| Fahrer noch nicht verfügbar (vor erstem Rennen) | Events werden geschrieben, Fahrer übersprungen |
| Partieller Fehler | Bereits geschriebene Daten bleiben, Fehlermeldung mit Details |

---

## Was nicht geändert wird

- `tips`-Collection: wird nie vom Sync berührt
- `scores`-Collection: wird nie vom Sync berührt
- `session_results`-Collection: wird nie vom Sync berührt (bleibt Phase 2)
- Bestehende Events aus Vorjahren: werden nie überschrieben oder gelöscht
