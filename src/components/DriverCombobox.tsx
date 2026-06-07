import { useState, useMemo } from 'react'
import { Combobox } from '@headlessui/react'
import type { Driver } from '../types'

interface Props {
  drivers: Driver[]
  value: string            // driverId
  onChange: (driverId: string) => void
  disabledIds: Set<string> // already selected in other positions
  disabled?: boolean
  placeholder?: string
}

export function DriverCombobox({ drivers, value, onChange, disabledIds, disabled, placeholder }: Props) {
  const [query, setQuery] = useState('')

  const selected = drivers.find(d => d.id === value) ?? null

  const filtered = useMemo(() => {
    if (!query) return drivers
    const q = query.toLowerCase()
    return drivers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      String(d.number).includes(q)
    )
  }, [drivers, query])

  return (
    <Combobox value={selected} onChange={d => d && onChange(d.id)} disabled={disabled} onClose={() => setQuery('')}>
      <div className="relative">
        <Combobox.Input
          className="w-full bg-f1-dark border border-f1-border rounded px-3 py-2 text-sm text-white placeholder-f1-muted focus:outline-none focus:border-f1-red disabled:opacity-50"
          displayValue={(d: Driver | null) => d ? `${d.code} – ${d.name}` : ''}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Fahrer wählen...'}
        />
        <Combobox.Options className="absolute z-20 mt-1 w-full bg-f1-card border border-f1-border rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-f1-muted text-sm">Kein Fahrer gefunden</div>
          )}
          {filtered.map(driver => {
            const isDisabled = disabledIds.has(driver.id) && driver.id !== value
            return (
              <Combobox.Option
                key={driver.id}
                value={driver}
                disabled={isDisabled}
                className={({ active }) =>
                  `px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                  ${active && !isDisabled ? 'bg-f1-border' : ''}
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`
                }
              >
                <span>{driver.code} – {driver.name}</span>
                <span className="text-f1-muted text-xs">{driver.team}</span>
              </Combobox.Option>
            )
          })}
        </Combobox.Options>
      </div>
    </Combobox>
  )
}
