import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { syncSeason, type SyncResult } from '../lib/sync'
import { syncResults, calculateScoresForSession, type SyncResultsResult } from '../lib/syncResults'
import { subscribeToEvents, getTipsForSession, saveTip, getUsers, getDrivers } from '../lib/firestore'
import { TipForm } from '../components/TipForm'
import type { F1Event, AppUser, Tip, TippableSessionType, Driver } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race: 'Sprint Race',
}

export function AdminPage() {
  const [seasonStatus, setSeasonStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [seasonResults, setSeasonResults] = useState<SyncResult[]>([])

  const [resultsStatus, setResultsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resultsResult, setResultsResult] = useState<SyncResultsResult | null>(null)

  const [errorMsg, setErrorMsg] = useState('')

  const [adminEvents, setAdminEvents] = useState<F1Event[]>([])
  const [adminUsers, setAdminUsers] = useState<AppUser[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [adminSession, setAdminSession] = useState<TippableSessionType>('qualifying')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [adminTip, setAdminTip] = useState<Tip | undefined>(undefined)
  const [adminDrivers, setAdminDrivers] = useState<Driver[]>([])
  const [adminSaveStatus, setAdminSaveStatus] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)

  const selectedEvent = adminEvents.find(e => e.id === selectedEventId) ?? null
  const adminSessions: TippableSessionType[] = selectedEvent?.isSprintWeekend
    ? ['sprint_qualifying', 'sprint_race', 'qualifying', 'race']
    : ['qualifying', 'race']

  useEffect(() => {
    const unsub = subscribeToEvents(es => setAdminEvents([...es].sort((a, b) => a.round - b.round)))
    getUsers().then(setAdminUsers)
    return unsub
  }, [])

  useEffect(() => {
    if (!selectedEventId) { setAdminDrivers([]); return }
    const parts = selectedEventId.split('_')
    const year = parseInt(parts[parts.length - 1] ?? String(new Date().getFullYear()))
    getDrivers(year).then(setAdminDrivers)
    if (!adminSessions.includes(adminSession)) setAdminSession('qualifying')
  }, [selectedEventId])

  useEffect(() => {
    if (!selectedEventId || !selectedUserId) { setAdminTip(undefined); return }
    setAdminTip(undefined)
    setAdminSaveStatus('')
    getTipsForSession(selectedEventId, adminSession).then(tips => {
      setAdminTip(tips.find(t => t.userId === selectedUserId))
    })
  }, [selectedEventId, adminSession, selectedUserId])

  async function handleAdminSave(sessionType: TippableSessionType, predictions: Record<string, string>) {
    if (!selectedEventId || !selectedUserId) return
    setAdminSaving(true)
    setAdminSaveStatus('')
    try {
      const tip: Omit<Tip, 'lockedAt'> = {
        id: `${selectedUserId}_${selectedEventId}_${sessionType}`,
        userId: selectedUserId,
        eventId: selectedEventId,
        sessionType,
        predictions,
        updatedAt: Timestamp.now(),
      }
      await saveTip(tip)
      const year = parseInt(selectedEventId.split('_').pop() ?? '2026')
      const scoreCount = await calculateScoresForSession(selectedEventId, sessionType, year)
      setAdminTip(tip as Tip)
      setAdminSaveStatus(scoreCount > 0 ? `Gespeichert + ${scoreCount} Punkte berechnet ✓` : 'Gespeichert ✓ (kein Ergebnis vorhanden)')
    } catch (err) {
      setAdminSaveStatus(err instanceof Error ? `Fehler: ${err.message}` : 'Unbekannter Fehler')
    } finally {
      setAdminSaving(false)
    }
  }

  async function handleSeasonSync() {
    setSeasonStatus('loading')
    setSeasonResults([])
    setErrorMsg('')
    try {
      const year = new Date().getFullYear()
      const r1 = await syncSeason(year)
      const r2 = await syncSeason(year + 1)
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
    <div className="max-w-2xl mx-auto py-8 space-y-8">
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

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-f1-muted mb-3">Tipps verwalten</h2>
        <div className="space-y-3">
          <select
            value={selectedEventId}
            onChange={e => { setSelectedEventId(e.target.value); setAdminSaveStatus('') }}
            className="w-full bg-f1-card border border-f1-border rounded px-3 py-2 text-sm text-white"
          >
            <option value="">— Event wählen —</option>
            {adminEvents.map(e => (
              <option key={e.id} value={e.id}>R{e.round} {e.name}</option>
            ))}
          </select>

          {selectedEvent && (
            <div className="flex gap-2 flex-wrap">
              {adminSessions.map(s => (
                <button
                  key={s}
                  onClick={() => { setAdminSession(s); setAdminSaveStatus('') }}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                    adminSession === s
                      ? 'bg-f1-red border-f1-red text-white'
                      : 'border-f1-border text-f1-muted hover:border-white hover:text-white'
                  }`}
                >
                  {SESSION_LABELS[s]}
                </button>
              ))}
            </div>
          )}

          {selectedEvent && (
            <select
              value={selectedUserId}
              onChange={e => { setSelectedUserId(e.target.value); setAdminSaveStatus('') }}
              className="w-full bg-f1-card border border-f1-border rounded px-3 py-2 text-sm text-white"
            >
              <option value="">— Spieler wählen —</option>
              {adminUsers.map(u => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          )}
        </div>

        {selectedEvent && selectedUserId && adminDrivers.length > 0 && (
          <div className="mt-4">
            <TipForm
              sessionType={adminSession}
              drivers={adminDrivers}
              existingTip={adminTip}
              locked={false}
              onSubmit={handleAdminSave}
            />
            {adminSaving && <p className="text-f1-muted text-sm mt-2">Speichern…</p>}
            {adminSaveStatus && (
              <p className={`text-sm mt-2 ${adminSaveStatus.startsWith('Fehler') ? 'text-red-400' : 'text-green-400'}`}>
                {adminSaveStatus}
              </p>
            )}
          </div>
        )}

        {selectedEvent && selectedUserId && adminDrivers.length === 0 && (
          <p className="text-f1-muted text-sm mt-3">Lade Fahrerdaten…</p>
        )}
      </div>
    </div>
  )
}
