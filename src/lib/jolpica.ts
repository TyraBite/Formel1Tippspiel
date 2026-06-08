const BASE = 'https://api.jolpi.ca/ergast/f1'

export interface JolpicaSprintRace {
  round: number
  results: Array<{ position: number; code: string; name: string }>
}

export async function getJolpicaSprintRaces(year: number): Promise<JolpicaSprintRace[]> {
  try {
    const res = await fetch(`${BASE}/${year}/sprint/?limit=100`)
    if (!res.ok) return []
    const data = await res.json()
    const races: any[] = data?.MRData?.RaceTable?.Races ?? []
    return races.map(race => ({
      round: parseInt(race.round),
      results: (race.SprintResults as any[])
        .filter(r => !isNaN(parseInt(r.position)))
        .map(r => ({
          position: parseInt(r.position),
          code: r.Driver.code as string,
          name: `${r.Driver.givenName} ${r.Driver.familyName}` as string,
        }))
        .sort((a, b) => a.position - b.position),
    }))
  } catch {
    return []
  }
}
