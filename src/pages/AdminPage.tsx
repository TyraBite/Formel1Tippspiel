import { useState } from 'react'
import { syncSeason, type SyncResult } from '../lib/sync'

export function AdminPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<SyncResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSync() {
    setStatus('loading')
    setResults([])
    setErrorMsg('')

    try {
      const year = new Date().getFullYear()
      const [r1, r2] = await Promise.all([
        syncSeason(year),
        syncSeason(year + 1),
      ])
      setResults([r1, r2])
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Admin</h1>
      <p className="text-f1-muted text-sm mb-6">Saison-Daten von der OpenF1 API synchronisieren</p>

      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        className="w-full bg-f1-red text-white px-4 py-3 rounded font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {status === 'loading' ? 'Synchronisiere...' : 'Saison synchronisieren'}
      </button>

      {status === 'done' && (
        <div className="mt-4 space-y-3">
          {results.map(r => (
            <div key={r.year} className="p-4 bg-f1-card rounded border border-f1-border">
              <p className="font-medium text-sm mb-1">Saison {r.year}</p>
              {r.skipped ? (
                <p className="text-f1-muted text-sm">Noch keine Daten verfügbar</p>
              ) : (
                <p className="text-f1-muted text-sm">
                  {r.eventsAdded} Events hinzugefügt · {r.eventsUpdated} aktualisiert
                  {r.driversAdded > 0 && ` · ${r.driversAdded} Fahrer importiert`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-950 rounded border border-red-800">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}
    </div>
  )
}
