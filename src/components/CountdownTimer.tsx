import { useState, useEffect } from 'react'
import type { Timestamp } from 'firebase/firestore'

interface Props {
  target: Timestamp
  label: string
}

export function CountdownTimer({ target, label }: Props) {
  const [diff, setDiff] = useState(0)

  useEffect(() => {
    function update() { setDiff(target.toDate().getTime() - Date.now()) }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])

  if (diff <= 0) return <span className="text-f1-muted text-sm">{label} hat begonnen</span>

  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  const fmt = (n: number) => String(n).padStart(2, '0')

  const date = target.toDate()
  const dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="text-center">
      <p className="text-f1-muted text-xs uppercase tracking-wider mb-1">{label} in</p>
      <p className="font-mono text-xl font-bold">
        {h > 0 && <>{fmt(h)}:</>}{fmt(m)}:{fmt(s)}
      </p>
      <p className="text-f1-muted text-xs mt-1">{dateStr}, {timeStr} Uhr</p>
    </div>
  )
}
