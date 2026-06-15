import type { Driver, DriverResult } from '../types'
import type { OpenF1Position, OpenF1SessionResult } from './openf1'

export function processSessionResults(
  results: OpenF1SessionResult[],
  driverByNumber: Map<number, Driver>
): DriverResult[] {
  return results
    .map(r => {
      const driver = driverByNumber.get(r.driver_number)
      return driver
        ? { position: r.position, driverId: driver.id, driverCode: driver.code, driverName: driver.name }
        : null
    })
    .filter((r): r is DriverResult => r !== null)
    .sort((a, b) => a.position - b.position)
}

export function processPositions(
  positions: OpenF1Position[],
  driverByNumber: Map<number, Driver>
): DriverResult[] {
  const byDriver = new Map<number, { position: number; date: string }>()
  for (const p of positions) {
    const existing = byDriver.get(p.driver_number)
    if (!existing || p.date > existing.date) {
      byDriver.set(p.driver_number, { position: p.position, date: p.date })
    }
  }
  return [...byDriver.entries()]
    .map(([driverNumber, { position }]) => {
      const driver = driverByNumber.get(driverNumber)
      return driver
        ? { position, driverId: driver.id, driverCode: driver.code, driverName: driver.name }
        : null
    })
    .filter((r): r is DriverResult => r !== null)
    .sort((a, b) => a.position - b.position)
}
