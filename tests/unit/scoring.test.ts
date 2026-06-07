import { calculateScore } from '../../src/lib/scoring'
import type { Tip, SessionResult, DriverResult } from '../../src/types'

function tip(predictions: Record<string, string>): Pick<Tip, 'predictions'> {
  return { predictions }
}

function result(rows: Array<{ pos: number; id: string }>): Pick<SessionResult, 'results'> {
  return {
    results: rows.map(r => ({
      position: r.pos,
      driverId: r.id,
      driverCode: r.id.slice(0, 3).toUpperCase(),
      driverName: r.id,
    } satisfies DriverResult)),
  }
}

describe('calculateScore', () => {
  it('awards 3 points for exact position match', () => {
    const s = calculateScore(tip({ '1': 'ver' }), result([{ pos: 1, id: 'ver' }]))
    expect(s.points).toBe(3)
    expect(s.breakdown[0].points).toBe(3)
  })

  it('awards 1 point for driver in top 10 at wrong position', () => {
    const s = calculateScore(
      tip({ '1': 'ver' }),
      result([{ pos: 1, id: 'lec' }, { pos: 3, id: 'ver' }])
    )
    expect(s.points).toBe(1)
    expect(s.breakdown[0].points).toBe(1)
  })

  it('awards 0 points for driver outside top 10', () => {
    const s = calculateScore(
      tip({ '1': 'sar' }),
      result([{ pos: 1, id: 'ver' }])
    )
    expect(s.points).toBe(0)
  })

  it('scores a perfect 10/10 prediction as 30 points', () => {
    const drivers = ['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10']
    const predictions: Record<string, string> = {}
    drivers.forEach((d, i) => { predictions[String(i + 1)] = d })
    const s = calculateScore(
      tip(predictions),
      result(drivers.map((id, i) => ({ pos: i + 1, id })))
    )
    expect(s.points).toBe(30)
  })

  it('exact position gives 3 not 4 (no double-counting)', () => {
    const s = calculateScore(tip({ '5': 'nor' }), result([{ pos: 5, id: 'nor' }]))
    expect(s.points).toBe(3)
  })

  it('handles missing predictions gracefully', () => {
    const s = calculateScore(tip({}), result([{ pos: 1, id: 'ver' }]))
    expect(s.points).toBe(0)
    expect(s.breakdown).toHaveLength(10)
  })

  it('returns breakdown with 10 entries always', () => {
    const s = calculateScore(tip({ '1': 'ver' }), result([{ pos: 1, id: 'ver' }]))
    expect(s.breakdown).toHaveLength(10)
  })
})
