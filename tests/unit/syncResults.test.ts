import { processPositions } from '../../src/lib/resultProcessing'
import type { Driver } from '../../src/types'
import type { OpenF1Position } from '../../src/lib/openf1'

function makeDriver(number: number, id: string): Driver {
  return { id, code: id.slice(0, 3).toUpperCase(), name: id, team: 'Team', number }
}

function pos(driverNumber: number, position: number, date: string): OpenF1Position {
  return { session_key: 1, driver_number: driverNumber, date, meeting_key: 1, position }
}

describe('processPositions', () => {
  it('returns empty array for empty input', () => {
    const result = processPositions([], new Map())
    expect(result).toEqual([])
  })

  it('maps driver_number to driverId via the map', () => {
    const drivers = new Map([[1, makeDriver(1, 'max_verstappen')]])
    const result = processPositions([pos(1, 1, '2026-05-25T15:00:00')], drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('max_verstappen')
    expect(result[0].driverCode).toBe('MAX')
    expect(result[0].position).toBe(1)
  })

  it('takes the last position entry per driver when multiple exist', () => {
    const drivers = new Map([[1, makeDriver(1, 'ver')]])
    const positions = [
      pos(1, 5, '2026-05-25T14:00:00'),
      pos(1, 1, '2026-05-25T16:00:00'),
      pos(1, 3, '2026-05-25T15:00:00'),
    ]
    const result = processPositions(positions, drivers)
    expect(result[0].position).toBe(1)
  })

  it('sorts results by position ascending', () => {
    const drivers = new Map([
      [1, makeDriver(1, 'ver')],
      [4, makeDriver(4, 'nor')],
      [16, makeDriver(16, 'lec')],
    ])
    const positions = [
      pos(16, 2, '2026-05-25T16:00:00'),
      pos(1, 1, '2026-05-25T16:00:00'),
      pos(4, 3, '2026-05-25T16:00:00'),
    ]
    const result = processPositions(positions, drivers)
    expect(result.map(r => r.driverId)).toEqual(['ver', 'lec', 'nor'])
  })

  it('skips drivers not found in the map', () => {
    const drivers = new Map([[1, makeDriver(1, 'ver')]])
    const positions = [pos(1, 1, '2026-05-25T16:00:00'), pos(99, 2, '2026-05-25T16:00:00')]
    const result = processPositions(positions, drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('ver')
  })
})
