import { useState } from 'react'
import { syncSeason, type SyncResult } from '../lib/sync'
import { syncResults, type SyncResultsResult } from '../lib/syncResults'

export function AdminPage() {
  const [seasonStatus, setSeasonStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [seasonResults, setSeasonResults] = useState<SyncResult[]>([])

  const [resultsStatus, setResultsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resultsResult, setResultsResult] = useState<SyncResultsResult | null>(null)

  const [errorMsg, setErrorMsg] = useState('')

  async function handleSeasonSync() {
    setSeasonStatus('loading')
    setSeasonResults([])
    setErrorMsg('')
    try {
      const year = new Date().getFullYear()
      const [r1, r2] = await Promise.all([syncSeason(year), syncSeason(year + 1)])
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
    <div className="max-w-md mx-auto py-8 space-y-8">
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
    </div>
  )
}
