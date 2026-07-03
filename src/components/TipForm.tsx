import { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DriverCombobox } from './DriverCombobox'
import { getTeamColor } from '../lib/teamColors'
import type { Driver, Tip, TippableSessionType } from '../types'

const SESSION_LABELS: Record<TippableSessionType, string> = {
  qualifying: 'Qualifying',
  race: 'Rennen',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race: 'Sprint Race',
}

interface Slot { key: string; driverId: string }

function GripIcon() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="9" cy="3" r="1.5" />
      <circle cx="3" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="3" cy="15" r="1.5" />
      <circle cx="9" cy="15" r="1.5" />
    </svg>
  )
}

interface RowProps {
  slot: Slot
  pos: number
  drivers: Driver[]
  disabledIds: Set<string>
  locked: boolean
  onChange: (key: string, driverId: string) => void
  inputRef: (el: HTMLInputElement | null) => void
}

function SortableRow({ slot, pos, drivers, disabledIds, locked, onChange, inputRef }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.key,
    disabled: locked,
  })

  const driver = drivers.find(d => d.id === slot.driverId)
  const teamColor = driver ? getTeamColor(driver.team) : 'transparent'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2"
    >
      {locked ? (
        <div className="w-5" />
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="text-f1-muted hover:text-white cursor-grab active:cursor-grabbing touch-none p-0.5 rounded"
          tabIndex={-1}
          type="button"
          aria-label={`Position ${pos} verschieben`}
        >
          <GripIcon />
        </button>
      )}
      <span className="text-f1-muted text-sm w-5 text-right font-mono shrink-0">{pos}</span>
      <span className="w-0.5 h-5 rounded-full shrink-0 transition-colors duration-200" style={{ backgroundColor: teamColor }} />
      <div className="flex-1">
        <DriverCombobox
          ref={inputRef}
          drivers={drivers}
          value={slot.driverId}
          onChange={driverId => onChange(slot.key, driverId)}
          disabledIds={disabledIds}
          disabled={locked}
          placeholder={`Position ${pos}`}
        />
      </div>
    </div>
  )
}

interface Props {
  sessionType: TippableSessionType
  drivers: Driver[]
  existingTip: Tip | undefined
  locked: boolean
  onSubmit: (sessionType: TippableSessionType, predictions: Record<string, string>) => Promise<void>
}

export function TipForm({ sessionType, drivers, existingTip, locked, onSubmit }: Props) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({ key: `slot-${i}`, driverId: '' }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(10).fill(null))

  // Key captures session + prediction content so the effect fires whenever predictions
  // arrive or change — not just when the tip ID changes (which can stay the same
  // while predictions are missing on a stale snapshot).
  const tipLoadKey = `${sessionType}:${
    existingTip
      ? Array.from({ length: 10 }, (_, i) => existingTip.predictions[String(i + 1)] ?? '').join(',')
      : 'none'
  }`

  useEffect(() => {
    setSlots(Array.from({ length: 10 }, (_, i) => ({
      key: `slot-${i}`,
      driverId: existingTip?.predictions[String(i + 1)] ?? '',
    })))
    setSaved(false)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipLoadKey])

  const selectedIds = new Set(slots.map(s => s.driverId).filter(Boolean))

  function handleSlotChange(key: string, driverId: string) {
    const idx = slots.findIndex(s => s.key === key)
    setSlots(prev => prev.map(s => s.key === key ? { ...s, driverId } : s))
    setSaved(false)
    if (idx >= 0 && idx < 9) {
      setTimeout(() => inputRefs.current[idx + 1]?.focus(), 50)
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSlots(prev => {
      const oldIndex = prev.findIndex(s => s.key === active.id)
      const newIndex = prev.findIndex(s => s.key === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setSaved(false)
  }

  async function handleSubmit() {
    const predictions: Record<string, string> = {}
    slots.forEach((s, i) => { if (s.driverId) predictions[String(i + 1)] = s.driverId })
    if (Object.keys(predictions).length < 10) {
      setError('Bitte alle 10 Positionen ausfüllen')
      return
    }
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map(s => s.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {slots.map((slot, i) => (
              <SortableRow
                key={slot.key}
                slot={slot}
                pos={i + 1}
                drivers={drivers}
                disabledIds={new Set([...selectedIds].filter(id => id !== slot.driverId))}
                locked={locked}
                onChange={handleSlotChange}
                inputRef={el => { inputRefs.current[i] = el }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
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
