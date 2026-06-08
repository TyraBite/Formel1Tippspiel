import { useState, useEffect, useRef } from 'react'
import { DriverCombobox } from './DriverCombobox'
import type { Driver, Tip, TippableSessionType } from '../types'

interface Props {
  sessionType: TippableSessionType
  drivers: Driver[]
  existingTip: Tip | undefined
  locked: boolean
  onSubmit: (sessionType: TippableSessionType, predictions: Record<string, string>) => Promise<void>
}

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race: 'Sprint Race',
}

export function TipForm({ sessionType, drivers, existingTip, locked, onSubmit }: Props) {
  const [predictions, setPredictions] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(10).fill(null))

  useEffect(() => {
    setPredictions(existingTip?.predictions ?? {})
    setSaved(false)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionType, existingTip?.id]) // reset on tab change and when tip identity changes

  const selectedIds = new Set(Object.values(predictions).filter(Boolean))

  function setPosition(pos: number, driverId: string) {
    setPredictions(prev => ({ ...prev, [String(pos)]: driverId }))
    setSaved(false)
    if (pos < 10) {
      setTimeout(() => inputRefs.current[pos]?.focus(), 50)
    }
  }

  async function handleSubmit() {
    const filled = Object.keys(predictions).filter(k => predictions[k]).length
    if (filled < 10) { setError('Bitte alle 10 Positionen ausfüllen'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit(sessionType, predictions)
      setSaved(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-f1-muted uppercase tracking-wider">
          Tipp: {SESSION_LABELS[sessionType]}
        </h3>
        {locked && (
          <span className="badge bg-f1-border text-f1-muted">Gesperrt</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(pos => (
          <div key={pos} className="flex items-center gap-3">
            <span className="text-f1-muted text-sm w-5 text-right font-mono">{pos}</span>
            <div className="flex-1">
              <DriverCombobox
                ref={el => { inputRefs.current[pos - 1] = el }}
                drivers={drivers}
                value={predictions[String(pos)] ?? ''}
                onChange={id => setPosition(pos, id)}
                disabledIds={new Set([...selectedIds].filter(id => id !== predictions[String(pos)]))}
                disabled={locked}
                placeholder={`Position ${pos}`}
              />
            </div>
          </div>
        ))}
      </div>
      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Speichern...' : 'Tipps speichern'}
          </button>
          {saved && <span className="text-f1-green text-sm">Gespeichert</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
      )}
    </div>
  )
}
