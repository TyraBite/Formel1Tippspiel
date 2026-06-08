const BASE = 'https://api.openf1.org/v1'

export interface OpenF1Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  circuit_short_name: string
  date_start: string
  year: number
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string
  meeting_key: number
  year: number
}

export interface OpenF1Driver {
  driver_number: number
  full_name: string
  name_acronym: string
  team_name: string
  session_key: number
}

export interface OpenF1Position {
  session_key: number
  driver_number: number
  date: string
  meeting_key: number
  position: number
}

async function get<T>(path: string, emptyOn404 = false): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    if (emptyOn404 && res.status === 404) return []
    throw new Error(`OpenF1 ${res.status}: ${path}`)
  }
  return res.json()
}

export const openf1 = {
  meetings: (year: number) => get<OpenF1Meeting>(`/meetings?year=${year}`),
  sessions: (year: number) => get<OpenF1Session>(`/sessions?year=${year}`),
  drivers: (sessionKey: number) => get<OpenF1Driver>(`/drivers?session_key=${sessionKey}`),
  positions: (sessionKey: number) => get<OpenF1Position>(`/position?session_key=${sessionKey}`, true),
}
