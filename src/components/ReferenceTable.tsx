import type { DriverResult } from '../types'

interface Props {
  results: DriverResult[] | null
  label: string
  isProvisional?: boolean
  isLoading?: boolean
}

export function ReferenceTable({ results, label, isProvisional, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="card">
        <p className="text-f1-muted text-sm">{label} — Lade…</p>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="card">
        <p className="text-f1-muted text-sm">{label} — Noch nicht verfügbar</p>
      </div>
    )
  }

  const top15 = results.filter(r => r.position <= 15)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-f1-muted uppercase tracking-wider mb-3">{label}</h3>
      <table className="w-full text-sm">
        <tbody>
          {top15.map(r => {
            const status = r.dsq ? 'DSQ' : r.dnf ? 'DNF' : r.dns ? 'DNS' : null
            return (
              <tr key={r.position} className="border-b border-f1-border last:border-0">
                <td className="py-1.5 w-8 text-f1-muted font-mono">{r.position}</td>
                <td className="py-1.5 font-medium w-12 text-f1-red">{r.driverCode}</td>
                <td className="py-1.5 text-white">
                  <span className={status ? 'line-through text-f1-muted' : ''}>{r.driverName}</span>
                  {status && <span className="ml-1.5 text-xs font-mono text-f1-muted">{status}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {isProvisional && (
        <p className="text-yellow-400 text-xs mt-2">⚠ Vorläufig — Investigations offen</p>
      )}
    </div>
  )
}
