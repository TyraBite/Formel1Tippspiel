import type { Driver, DriverResult, TippableSessionType } from '../types'

const BASE = 'https://api.jolpi.ca/ergast/f1'

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[Jolpica] ${res.status}: ${url}`)
      return null
    }
    return res.json()
  } catch {
    console.warn(`[Jolpica] fetch failed: ${url}`)
    return null
  }
}

function mapResults(raw: any[], driverByNumber: Map<number, Driver>): DriverResult[] {
  return raw.flatMap((r): DriverResult[] => {
    const num = parseInt(r.Driver?.permanentNumber ?? r.number ?? '')
    if (isNaN(num)) return []
    const driver = driverByNumber.get(num)
    if (!driver || !r.position) return []
    const pt = r.positionText ?? String(r.position)
    return [{
      position: parseInt(r.position),
      driverId: driver.id,
      driverCode: driver.code,
      driverName: driver.name,
      ...(pt === 'R' ? { dnf: true } : {}),
      ...(pt === 'W' ? { dns: true } : {}),
      ...(pt === 'D' ? { dsq: true } : {}),
    }]
  }).sort((a, b) => a.position - b.position)
}

export async function jolpicaResults(
  sessionType: TippableSessionType,
  year: number,
  round: number,
  driverByNumber: Map<number, Driver>
): Promise<DriverResult[]> {
  if (sessionType === 'sprint_qualifying') return []

  const path = sessionType === 'race'      ? `/${year}/${round}/results.json`
             : sessionType === 'qualifying' ? `/${year}/${round}/qualifying.json`
             : `/${year}/${round}/sprint.json`

  const data = await getJson(`${BASE}${path}`)
  const races: any[] = data?.MRData?.RaceTable?.Races ?? []
  if (races.length === 0) return []

  const raw: any[] = sessionType === 'qualifying'
    ? (races[0].QualifyingResults ?? [])
    : (races[0].Results ?? races[0].SprintResults ?? [])

  return mapResults(raw, driverByNumber)
}
