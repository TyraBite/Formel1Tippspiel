import type { Tip, SessionResult, ScoreBreakdown } from '../types'

export interface ScoreResult {
  points: number
  breakdown: ScoreBreakdown[]
}

export function calculateScore(
  tip: Pick<Tip, 'predictions'>,
  result: Pick<SessionResult, 'results'>
): ScoreResult {
  const top10Ids = new Set(
    result.results.filter(r => r.position <= 10).map(r => r.driverId)
  )
  const posMap = new Map(result.results.map(r => [r.position, r.driverId]))

  let points = 0
  const breakdown: ScoreBreakdown[] = []

  for (let pos = 1; pos <= 10; pos++) {
    const predictedDriverId = tip.predictions[String(pos)] ?? ''
    const actualDriverId = posMap.get(pos) ?? ''
    let p = 0
    if (predictedDriverId && predictedDriverId === actualDriverId) {
      p = 3
    } else if (predictedDriverId && top10Ids.has(predictedDriverId)) {
      p = 1
    }
    points += p
    breakdown.push({ pos, predictedDriverId, actualDriverId, points: p })
  }

  return { points, breakdown }
}
