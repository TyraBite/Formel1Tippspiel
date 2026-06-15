import { processPositions, processSessionResults } from '../../src/lib/resultProcessing'
import type { Driver } from '../../src/types'
import type { OpenF1Position, OpenF1SessionResult } from '../../src/lib/openf1'

function makeDriver(number: number, id: string): Driver {
  return { id, code: id.slice(0, 3).toUpperCase(), name: id, team: 'Team', number }
}

function pos(driverNumber: number, position: number | null, date: string): OpenF1Position {
  return { session_key: 1, driver_number: driverNumber, date, meeting_key: 1, position }
}

function sessionResult(driverNumber: number, position: number | null, dnf = false): OpenF1SessionResult {
  return {
    session_key: 1, meeting_key: 1, driver_number: driverNumber,
    position, points: 0, dnf, dns: false, dsq: false,
    duration: null, gap_to_leader: 0, number_of_laps: 0,
  }
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

  it('skips entries with null position', () => {
    const drivers = new Map([[27, makeDriver(27, 'hulkenberg')]])
    const result = processPositions([pos(27, null, '2026-05-25T16:00:00')], drivers)
    expect(result).toEqual([])
  })
})

describe('processSessionResults', () => {
  it('returns empty array for empty input', () => {
    expect(processSessionResults([], new Map())).toEqual([])
  })

  it('maps driver_number to driverId, driverCode and position', () => {
    const drivers = new Map([[44, makeDriver(44, 'lewis_hamilton')]])
    const result = processSessionResults([sessionResult(44, 1)], drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('lewis_hamilton')
    expect(result[0].driverCode).toBe('LEW')
    expect(result[0].position).toBe(1)
  })

  it('filters out entries with null position (unclassified DNF)', () => {
    const drivers = new Map([
      [44, makeDriver(44, 'hamilton')],
      [27, makeDriver(27, 'hulkenberg')],
    ])
    const result = processSessionResults(
      [sessionResult(44, 1), sessionResult(27, null, true)],
      drivers
    )
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('hamilton')
  })

  it('sorts results by position ascending', () => {
    const drivers = new Map([
      [1, makeDriver(1, 'ver')],
      [4, makeDriver(4, 'nor')],
      [16, makeDriver(16, 'lec')],
    ])
    const result = processSessionResults(
      [sessionResult(16, 3), sessionResult(1, 1), sessionResult(4, 2)],
      drivers
    )
    expect(result.map(r => r.driverId)).toEqual(['ver', 'nor', 'lec'])
  })

  it('skips drivers not found in the map', () => {
    const drivers = new Map([[44, makeDriver(44, 'hamilton')]])
    const result = processSessionResults([sessionResult(44, 1), sessionResult(99, 2)], drivers)
    expect(result).toHaveLength(1)
    expect(result[0].driverId).toBe('hamilton')
  })

  it('handles mix of classified and unclassified finishers', () => {
    const drivers = new Map([
      [1, makeDriver(1, 'ver')],
      [4, makeDriver(4, 'nor')],
      [27, makeDriver(27, 'hul')],
    ])
    const result = processSessionResults(
      [sessionResult(1, 1), sessionResult(27, null, true), sessionResult(4, 2)],
      drivers
    )
    expect(result).toHaveLength(2)
    expect(result.map(r => r.driverId)).toEqual(['ver', 'nor'])
  })
})
