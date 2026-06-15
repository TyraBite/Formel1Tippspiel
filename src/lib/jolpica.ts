const BASE = 'https://api.jolpi.ca/ergast/f1'

export interface JolpicaRaceResult {
  round: number
  results: Array<{ position: number; code: string; name: string }>
}

function parseRaceResults(races: any[], resultsKey: string): JolpicaRaceResult[] {
  return races.map(race => ({
    round: parseInt(race.round),
    results: (race[resultsKey] as any[])
      .filter(r => !isNaN(parseInt(r.position)))
      .map(r => ({
        position: parseInt(r.position),
        code: r.Driver.code as string,
        name: `${r.Driver.givenName} ${r.Driver.familyName}` as string,
      }))
      .sort((a, b) => a.position - b.position),
  }))
}

export async function getJolpicaRaces(year: number): Promise<JolpicaRaceResult[]> {
  try {
    const res = await fetch(`${BASE}/${year}/results/?limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    return parseRaceResults(data?.MRData?.RaceTable?.Races ?? [], 'Results')
  } catch {
    return []
  }
}

export async function getJolpicaSprintRaces(year: number): Promise<JolpicaRaceResult[]> {
  try {
    const res = await fetch(`${BASE}/${year}/sprint/?limit=100`)
    if (!res.ok) return []
    const data = await res.json()
    return parseRaceResults(data?.MRData?.RaceTable?.Races ?? [], 'SprintResults')
  } catch {
    return []
  }
}
