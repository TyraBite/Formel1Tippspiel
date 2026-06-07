import type { SessionResult } from '../types'

interface Props {
  result: SessionResult | null
  label: string
}

export function ReferenceTable({ result, label }: Props) {
  if (!result) {
    return (
      <div className="card">
        <p className="text-f1-muted text-sm">{label} — Noch nicht verfügbar</p>
      </div>
    )
  }

  const top15 = result.results.filter(r => r.position <= 15)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-3">{label}</h3>
      <table className="w-full text-sm">
        <tbody>
          {top15.map(r => (
            <tr key={r.position} className="border-b border-f1-border last:border-0">
              <td className="py-1.5 w-8 text-f1-muted font-mono">{r.position}</td>
              <td className="py-1.5 font-medium w-12 text-f1-red">{r.driverCode}</td>
              <td className="py-1.5 text-white">{r.driverName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.status === 'provisional' && (
        <p className="text-yellow-400 text-xs mt-2">⚠ Vorläufig — Investigations offen</p>
      )}
    </div>
  )
}
